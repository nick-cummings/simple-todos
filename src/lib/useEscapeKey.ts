"use client";

import { useEffect } from "react";

/**
 * Calls `onEscape` whenever the Escape key is pressed, while `enabled`.
 *
 * The listener is attached to the window so it fires regardless of where
 * focus currently sits (overlay, trigger, or inside the dialog). It is
 * removed on cleanup and whenever `enabled` flips to false.
 *
 * Pass a stable `onEscape` (e.g. a `useCallback`) to avoid re-subscribing
 * on every render.
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [onEscape, enabled]);
}
