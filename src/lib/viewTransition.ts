"use client";

import { flushSync } from "react-dom";

type StartViewTransition = (cb: () => void) => { finished: Promise<void> };

function supported(): boolean {
  if (typeof document === "undefined") return false;
  return typeof (document as unknown as { startViewTransition?: unknown })
    .startViewTransition === "function";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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
  const start = (document as unknown as { startViewTransition: StartViewTransition })
    .startViewTransition;
  start(() => {
    // flushSync forces React to commit the update synchronously before the
    // browser captures the "new" snapshot.
    flushSync(callback);
  });
}
