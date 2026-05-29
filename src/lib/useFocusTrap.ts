"use client";

import { type RefObject, useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Keeps keyboard focus inside `containerRef` while `enabled`.
 *
 * - On activation, pulls focus into the container if it isn't already
 *   there (covers the case where the trigger outside the dialog still
 *   holds focus, e.g. a modal opened in a read-only view).
 * - Tab past the last focusable wraps to the first; Shift+Tab past the
 *   first wraps to the last. A Tab from outside the container is pulled
 *   back to the first focusable.
 * - On cleanup (unmount or `enabled` → false), restores focus to whatever
 *   was focused when the trap activated — the trigger element.
 *
 * The keydown listener is attached to the window so a Tab pressed while
 * focus sits on the trigger (outside the container) is still caught.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (!container.contains(document.activeElement)) {
      getFocusable(container)[0]?.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!last) return;
      const active = document.activeElement;
      const inside = container.contains(active);
      if (e.shiftKey) {
        if (!inside || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    globalThis.addEventListener("keydown", onKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [containerRef, enabled]);
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ].filter((el) => el.tabIndex !== -1);
}
