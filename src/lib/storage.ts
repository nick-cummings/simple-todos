// Centralized, quota-aware wrapper around `localStorage.setItem`.
//
// The default `localStorage.setItem` throws `QuotaExceededError`
// when the per-origin storage budget (5-10MB on Safari) is full.
// Writes from `saveTodos`, `saveLabels`, and `writeBackupToStorage`
// all flow through `safeWrite` so a hit-the-cap event:
//
//   1. doesn't crash the caller (returns `false`),
//   2. reports to Sentry tagged `area: storage`,
//   3. notifies any UI listeners so the app can surface a banner
//      directing the user to export + clear data.
//
// We don't try to monitor *approaching* quota via
// `navigator.storage.estimate()` — that API is poorly supported on
// Safari (the target platform) and the recovery path is the same
// either way. Surface the hit-the-cap case loudly; trust the user
// to read the banner and act.

import * as Sentry from "@sentry/nextjs";

import { isBrowser } from "./runtime";

export type StorageError = "quota_exceeded" | "unavailable" | "unknown";

type Listener = (error: StorageError, key: string) => void;
const listeners = new Set<Listener>();

/**
 * Write to localStorage. Returns `true` on success, `false` on any
 * failure (quota, missing localStorage, unknown). On failure, reports
 * to Sentry and notifies subscribers.
 *
 * Callers can usually ignore the boolean — the user's editing flow
 * doesn't depend on the persistence succeeding, just on the in-memory
 * state staying coherent. But surfaces that *can* react (e.g. import
 * confirmation in Settings) should branch on it.
 */
export function safeWrite(key: string, value: string): boolean {
    if (!isBrowser() || typeof globalThis.localStorage === "undefined") {
        notify("unavailable", key);
        return false;
    }
    try {
        globalThis.localStorage.setItem(key, value);
        return true;
    } catch (error: unknown) {
        const code = classify(error);
        Sentry.captureException(error, {
            tags: { area: "storage", code, key },
        });
        notify(code, key);
        return false;
    }
}

/**
 * Subscribe to storage write errors. Returns an unsubscribe
 * function. The listener fires once per failed write — multiple
 * writes during the same quota-full window will fire multiple
 * times; UI consumers should debounce or only show one banner.
 */
export function subscribeToStorageErrors(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function classify(error: unknown): StorageError {
    if (!(error instanceof Error)) return "unknown";
    // Spec-compliant browsers throw DOMException with name
    // "QuotaExceededError". Older Safari throws with the legacy
    // code 22 and name "QUOTA_EXCEEDED_ERR".
    if (error.name === "QuotaExceededError") return "quota_exceeded";
    if (error.name === "QUOTA_EXCEEDED_ERR") return "quota_exceeded";
    if (error.name === "NS_ERROR_DOM_QUOTA_REACHED") return "quota_exceeded";
    // Cast to access legacy `code` field without a type clash.
    const legacy = error as Error & { code?: number };
    if (legacy.code === 22) return "quota_exceeded";
    return "unknown";
}

function notify(error: StorageError, key: string): void {
    for (const listener of listeners) listener(error, key);
}
