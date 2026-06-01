"use client";

import { flushSync } from "react-dom";

import { isBrowser } from "./runtime";

type StartViewTransition = (cb: () => void) => { finished: Promise<void> };

/**
 * Runs a state update inside a View Transition so the browser animates
 * layout changes (FLIP), entries, and exits between snapshots.
 * Falls back to a synchronous update if the API is unavailable or the
 * user prefers reduced motion.
 */
export function withViewTransition(callback: () => void): void {
    if (!supported() || prefersReducedMotion()) {
        callback();
        return;
    }
    // Must be called as a method on `document` — extracting the function and
    // invoking it bare throws "Illegal invocation" (loses its `this`).
    (
        document as unknown as { startViewTransition: StartViewTransition }
    ).startViewTransition(() => {
        // flushSync forces React to commit the update synchronously before the
        // browser captures the "new" snapshot.
        flushSync(callback);
    });
}

function prefersReducedMotion(): boolean {
    if (!isBrowser()) return false;
    return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function supported(): boolean {
    if (!isBrowser()) return false;
    return (
        typeof (document as unknown as { startViewTransition?: unknown })
            .startViewTransition === "function"
    );
}
