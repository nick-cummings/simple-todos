"use client";

import { useEffect } from "react";

function isTypingTarget(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement | null;
    if (!target || !target.tagName) return false;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || target.isContentEditable;
}

interface ShortcutHandlers {
    onFocusSearch: () => void;
    onOpenHelp: () => void;
    onOpenNew: () => void;
}

/**
 * Registers global keyboard shortcuts for the todo app.
 *
 * ⌘K / Ctrl+K and / focus search; n opens the new-todo modal; ? opens the
 * shortcuts help overlay. Single-character shortcuts (/, n, ?) are suppressed
 * while focus is inside an input, textarea, or contenteditable. ⌘K / Ctrl+K
 * fires unconditionally since it does not conflict with typing.
 */
export function useShortcuts({
    onFocusSearch,
    onOpenHelp,
    onOpenNew,
}: ShortcutHandlers) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                onFocusSearch();
                return;
            }
            if (isTypingTarget(e)) return;
            if (e.key === "/") {
                e.preventDefault();
                onFocusSearch();
            } else if (e.key === "n" || e.key === "N") {
                e.preventDefault();
                onOpenNew();
            } else if (e.key === "?") {
                onOpenHelp();
            }
        };
        globalThis.addEventListener("keydown", onKeyDown);
        return () => {
            globalThis.removeEventListener("keydown", onKeyDown);
        };
    }, [onFocusSearch, onOpenHelp, onOpenNew]);
}
