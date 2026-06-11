import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useShortcuts } from "./useShortcuts";

function makeHandlers() {
    return {
        onFocusSearch: vi.fn(),
        onOpenHelp: vi.fn(),
        onOpenNew: vi.fn(),
    };
}

function press(key: string, opts: KeyboardEventInit = {}) {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key, ...opts }));
}

function pressInField(key: string, tag: "input" | "textarea") {
    const el = document.createElement(tag);
    document.body.appendChild(el);
    el.focus();
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    el.remove();
}

describe("useShortcuts", () => {
    it("/ focuses search", () => {
        const h = makeHandlers();
        renderHook(() => useShortcuts(h));
        press("/");
        expect(h.onFocusSearch).toHaveBeenCalledTimes(1);
    });

    it("n opens new todo", () => {
        const h = makeHandlers();
        renderHook(() => useShortcuts(h));
        press("n");
        expect(h.onOpenNew).toHaveBeenCalledTimes(1);
    });

    it("N opens new todo (uppercase)", () => {
        const h = makeHandlers();
        renderHook(() => useShortcuts(h));
        press("N");
        expect(h.onOpenNew).toHaveBeenCalledTimes(1);
    });

    it("? opens help overlay", () => {
        const h = makeHandlers();
        renderHook(() => useShortcuts(h));
        press("?");
        expect(h.onOpenHelp).toHaveBeenCalledTimes(1);
    });

    it("⌘K focuses search", () => {
        const h = makeHandlers();
        renderHook(() => useShortcuts(h));
        press("k", { metaKey: true });
        expect(h.onFocusSearch).toHaveBeenCalledTimes(1);
    });

    it("Ctrl+K focuses search", () => {
        const h = makeHandlers();
        renderHook(() => useShortcuts(h));
        press("k", { ctrlKey: true });
        expect(h.onFocusSearch).toHaveBeenCalledTimes(1);
    });

    it("/ is suppressed while focus is in an input", () => {
        const h = makeHandlers();
        renderHook(() => useShortcuts(h));
        pressInField("/", "input");
        expect(h.onFocusSearch).not.toHaveBeenCalled();
    });

    it("n is suppressed while focus is in a textarea", () => {
        const h = makeHandlers();
        renderHook(() => useShortcuts(h));
        pressInField("n", "textarea");
        expect(h.onOpenNew).not.toHaveBeenCalled();
    });

    it("? is suppressed while focus is in an input", () => {
        const h = makeHandlers();
        renderHook(() => useShortcuts(h));
        pressInField("?", "input");
        expect(h.onOpenHelp).not.toHaveBeenCalled();
    });

    it("⌘K is NOT suppressed while focus is in an input", () => {
        const h = makeHandlers();
        renderHook(() => useShortcuts(h));
        const el = document.createElement("input");
        document.body.appendChild(el);
        el.focus();
        el.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
            }),
        );
        el.remove();
        expect(h.onFocusSearch).toHaveBeenCalledTimes(1);
    });

    it("unrelated keys do nothing", () => {
        const h = makeHandlers();
        renderHook(() => useShortcuts(h));
        press("a");
        press("Enter");
        press("Tab");
        expect(h.onFocusSearch).not.toHaveBeenCalled();
        expect(h.onOpenNew).not.toHaveBeenCalled();
        expect(h.onOpenHelp).not.toHaveBeenCalled();
    });

    it("removes its listener on unmount", () => {
        const h = makeHandlers();
        const { unmount } = renderHook(() => useShortcuts(h));
        unmount();
        press("n");
        press("/");
        press("?");
        expect(h.onFocusSearch).not.toHaveBeenCalled();
        expect(h.onOpenNew).not.toHaveBeenCalled();
        expect(h.onOpenHelp).not.toHaveBeenCalled();
    });
});
