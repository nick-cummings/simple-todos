// Thin wrapper around `web-push` so the cron handler doesn't need to
// repeat VAPID setup. Resolves the keys from env lazily; a missing
// key throws on first send (the cron auth check should catch a
// missing key earlier, but defense in depth is cheap).

import webpush, { type WebPushError } from "web-push";

import type { PushSubscriptionJSON, ReminderRecord } from "./pushStore";

let configured = false;

export interface PushOutcome {
  status: "expired" | "failed" | "sent";
  statusCode?: number;
}

/** Test-only: forget the cached configure state. */
export function __resetWebPush(): void {
  configured = false;
}

/**
 * Send a Web Push notification for one reminder. Returns "expired"
 * (HTTP 404/410 — drop the subscription), "failed" (any other
 * error), or "sent". Never throws — the cron handler iterates
 * through reminders and shouldn't crash on a single bad sub.
 */
export async function sendReminderPush(
  subscription: PushSubscriptionJSON,
  reminder: ReminderRecord,
): Promise<PushOutcome> {
  configure();
  const payload = JSON.stringify({
    body: reminder.body,
    title: reminder.title,
    todoId: reminder.todoId,
    url: reminder.url,
  });
  try {
    await webpush.sendNotification(subscription, payload);
    return { status: "sent" };
  } catch (error: unknown) {
    const statusCode = (error as undefined | WebPushError)?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      return { status: "expired", statusCode };
    }
    return { status: "failed", statusCode };
  }
}

function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Missing VAPID env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT",
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}
