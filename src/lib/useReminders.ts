"use client";

import { useCallback, useEffect, useState } from "react";

import type { Todo } from "./todos";

import { isBrowser } from "./runtime";
import { safeWrite } from "./storage";

const BROWSER_ID_KEY = "simple-todos:browserId";
const PERMISSION_PROMPTED_KEY = "simple-todos:reminders:prompted";
// Cron is daily at 15:00 UTC, so reminders are sent at the next
// cron run on/after the dueDate. We register fireAt = midnight UTC
// of the dueDate, which causes the cron to pick it up on the dueDate
// itself.
const FIRE_HOUR_UTC = 0;

export type PermissionState = "denied" | "granted" | "prompt" | "unsupported";

export interface UseRemindersOptions {
  /**
   * Public VAPID key (provided by `NEXT_PUBLIC_VAPID_PUBLIC_KEY`).
   * If empty, the hook reports `unsupported` and stays inert.
   */
  vapidPublicKey?: string;
}

export interface UseRemindersResult {
  /** True when permission has been granted AND a subscription is on file. */
  active: boolean;
  /** Tear down the subscription (forget on server, drop from browser). */
  disable: () => Promise<void>;
  /** Trigger the permission prompt + subscribe flow. */
  enable: () => Promise<boolean>;
  /** Whether the gate UI should be shown. */
  needsAttention: boolean;
  permission: PermissionState;
  /**
   * Sync a single todo's reminder state. Computes fireAt and either
   * POSTs (if reminder needed) or DELETEs (if not). Safe to call on
   * every todo change; the server is the source of truth.
   */
  syncTodoReminder: (todo: Todo) => Promise<void>;
}

/**
 * Compute the epoch ms at which the cron may fire a reminder for the
 * given dueDate. We anchor at midnight UTC of the dueDate so the
 * 15:00 UTC cron run picks it up on that day.
 */
export function fireAtForDueDate(dueDate: string | undefined): null | number {
  if (!dueDate) return null;
  const [y, m, d] = dueDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d, FIRE_HOUR_UTC, 0, 0);
}

export function useReminders(
  opts: UseRemindersOptions = {},
): UseRemindersResult {
  const { vapidPublicKey } = opts;
  // Always start as "unsupported" so the SSR-rendered HTML matches
  // the first client render (no <RemindersGate /> in either). The
  // real permission state is picked up in the mount effect below.
  // Before this, hydration mismatched in production whenever the
  // VAPID env var was set, and React's recovery re-rendered the
  // whole tree — visibly stripping the `dark` class transient and
  // breaking deep links.
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [active, setActive] = useState(false);

  // Hydrate `active` from localStorage on mount; the actual
  // PushSubscription object lives in the service worker registration,
  // but we cache "active" so the UI doesn't flicker the gate on
  // every load.
  useEffect(() => {
    if (!isBrowser()) return;
    void (async () => {
      const cur = currentPermission();
      setPermission(cur);
      if (cur !== "granted") {
        setActive(false);
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setActive(Boolean(sub));
      } catch {
        setActive(false);
      }
    })();
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!isBrowser() || !vapidPublicKey) return false;
    if (!("Notification" in globalThis) || !("serviceWorker" in navigator))
      return false;
    let perm = currentPermission();
    if (perm === "prompt") {
      const result = await Notification.requestPermission();
      perm = result === "granted" ? "granted" : "denied";
      safeWrite(PERMISSION_PROMPTED_KEY, "1");
    }
    setPermission(perm);
    if (perm !== "granted") return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      sub ??= await reg.pushManager.subscribe({
        // applicationServerKey wants an ArrayBufferView<ArrayBuffer>,
        // and Uint8Array's ArrayBufferLike doesn't satisfy that
        // signature in the latest TS lib. The bytes are valid either
        // way; cast through BufferSource to bypass the over-narrow
        // typing.
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as unknown as BufferSource,
        userVisibleOnly: true,
      });
      await fetch("/api/push/subscribe", {
        body: JSON.stringify({
          browserId: ensureBrowserId(),
          subscription: sub.toJSON(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setActive(true);
      return true;
    } catch {
      setActive(false);
      return false;
    }
  }, [vapidPublicKey]);

  const disable = useCallback(async (): Promise<void> => {
    if (!isBrowser()) return;
    const browserId = readBrowserId();
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch {
      // best effort
    }
    if (browserId) {
      await fetch("/api/push/subscribe", {
        body: JSON.stringify({ browserId }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      }).catch(swallow);
    }
    setActive(false);
  }, []);

  const syncTodoReminder = useCallback(
    async (todo: Todo): Promise<void> => {
      if (!isBrowser()) return;
      const browserId = readBrowserId();
      if (!browserId) return;
      const reminderId = `r-${todo.id}`;
      const shouldRemind =
        active &&
        permission === "granted" &&
        Boolean(todo.dueDate) &&
        !todo.completed;
      if (!shouldRemind) {
        await fetch(`/api/push/reminders/${encodeURIComponent(reminderId)}`, {
          method: "DELETE",
        }).catch(swallow);
        return;
      }
      const fireAt = fireAtForDueDate(todo.dueDate);
      if (fireAt === null) return;
      await fetch("/api/push/reminders", {
        body: JSON.stringify({
          body: "Due today.",
          browserId,
          fireAt,
          id: reminderId,
          title: todo.title,
          todoId: todo.id,
          url: `/?todo=${encodeURIComponent(todo.id)}`,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }).catch(swallow);
    },
    [active, permission],
  );

  // Surface the gate when:
  //  - permission is "prompt" and the user hasn't been asked yet (onboarding), OR
  //  - permission is "denied" (always — gives them a way to retry after granting
  //    via the OS prompt or after installing the PWA on iOS, which is required
  //    for push permission to even be available).
  const needsAttention =
    Boolean(vapidPublicKey) &&
    !active &&
    (permission === "denied" ||
      (permission === "prompt" && !hasBeenPrompted()));

  return {
    active,
    disable,
    enable,
    needsAttention,
    permission,
    syncTodoReminder,
  };
}

// ---------- internals ----------

function currentPermission(): PermissionState {
  if (
    typeof globalThis.window === "undefined" ||
    !("Notification" in globalThis) ||
    !("serviceWorker" in navigator)
  ) {
    return "unsupported";
  }
  const p = Notification.permission;
  if (p === "granted") return "granted";
  if (p === "denied") return "denied";
  return "prompt";
}

function ensureBrowserId(): string {
  if (typeof globalThis.window === "undefined") return "";
  let id = globalThis.localStorage.getItem(BROWSER_ID_KEY);
  if (!id) {
    id = makeBrowserId();
    // If persistence fails (quota/unavailable) we still return the
    // in-memory id for this session; a fresh one is minted next load.
    safeWrite(BROWSER_ID_KEY, id);
  }
  return id;
}

function hasBeenPrompted(): boolean {
  if (typeof globalThis.window === "undefined") return true;
  return Boolean(globalThis.localStorage.getItem(PERMISSION_PROMPTED_KEY));
}

function makeBrowserId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // eslint-disable-next-line sonarjs/pseudo-random
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readBrowserId(): null | string {
  if (typeof globalThis.window === "undefined") return null;
  return globalThis.localStorage.getItem(BROWSER_ID_KEY);
}

// Swallow rejections from best-effort fetches (subscription/reminder
// sync). We don't want a transient network blip to throw inside an
// effect — the next sync round will re-converge.
function swallow(): void {
  /* noop */
}

// Convert the base64url VAPID public key into the Uint8Array
// PushManager.subscribe wants.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    // VAPID keys are ASCII bytes only — codePointAt is equivalent to
    // charCodeAt here but satisfies the unicorn/prefer-code-point
    // rule which catches genuine surrogate-pair bugs elsewhere.
    out[i] = raw.codePointAt(i) ?? 0;
  }
  return out;
}
