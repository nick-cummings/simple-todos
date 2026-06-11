"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
    onFocusSearch: () => void;
    onOpenHelp: () => void;
    onOpenNew: () => void;
}

function isTypingTarget(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement | null;
    if (!target?.tagName) return false;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || target.isContentEditable;
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
            switch (e.key) {
                case "/":
                    e.preventDefault();
                    onFocusSearch();
                    break;
                case "n":
                case "N":
                    e.preventDefault();
                    onOpenNew();
                    break;
                case "?":
                    onOpenHelp();
                    break;
            }
        };
        globalThis.addEventListener("keydown", onKeyDown);
        return () => {
            globalThis.removeEventListener("keydown", onKeyDown);
        };
    }, [onFocusSearch, onOpenHelp, onOpenNew]);
}
