import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_KEY } from "./theme";

// Seam mock (ADR 0008 / ADR 0012): the hook must persist through
// `safeWrite`, not raw `localStorage.setItem`. The default
// implementation writes through so the rest of the suite still
// observes persistence; individual tests override it to assert the
// call shape or simulate the failure path.
vi.mock("./storage", () => ({
    safeWrite: vi.fn((key: string, value: string) => {
        globalThis.localStorage.setItem(key, value);
        return true;
    }),
}));

// Resolve the mocked `safeWrite` instance the freshly imported hook
// uses (module registry is shared until the next resetModules).
async function getSafeWriteMock() {
    const { safeWrite } = await import("./storage");
    return vi.mocked(safeWrite);
}

async function importUseTheme() {
    vi.resetModules();
    const mod = await import("./useTheme");
    return mod.useTheme;
}

beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
});

afterEach(() => {
    vi.restoreAllMocks();
});

function mockMatchMedia(matches: boolean) {
    const state = { matches };
    const listeners: ((e: { matches: boolean }) => void)[] = [];
    const mql = {
        addEventListener: vi.fn(
            (_: string, cb: (e: { matches: boolean }) => void) => {
                listeners.push(cb);
            },
        ),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        get matches() {
            return state.matches;
        },
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
    };
    vi.spyOn(globalThis, "matchMedia").mockImplementation(
        () => mql as unknown as MediaQueryList,
    );
    return {
        fire: (m: boolean) => {
            state.matches = m;
            for (const cb of listeners) cb({ matches: m });
        },
        mql,
    };
}

describe("useTheme", () => {
    it("defaults to 'system' when nothing is stored", async () => {
        mockMatchMedia(false);
        const useTheme = await importUseTheme();
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe("system");
    });

    it("reads the stored theme on mount", async () => {
        localStorage.setItem(THEME_KEY, "dark");
        mockMatchMedia(false);
        const useTheme = await importUseTheme();
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe("dark");
    });

    it("setTheme updates state, persists, and applies the resolved theme", async () => {
        mockMatchMedia(false);
        const useTheme = await importUseTheme();
        const { result } = renderHook(() => useTheme());
        act(() => {
            result.current.setTheme("dark");
        });
        expect(result.current.theme).toBe("dark");
        expect(localStorage.getItem(THEME_KEY)).toBe("dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("setTheme persists through safeWrite, not raw localStorage", async () => {
        mockMatchMedia(false);
        const useTheme = await importUseTheme();
        const safeWrite = await getSafeWriteMock();
        const { result } = renderHook(() => useTheme());
        act(() => {
            result.current.setTheme("dark");
        });
        expect(safeWrite).toHaveBeenCalledWith(THEME_KEY, "dark");
    });

    it("setTheme survives a safeWrite failure (returns false) without throwing", async () => {
        mockMatchMedia(false);
        const useTheme = await importUseTheme();
        const safeWrite = await getSafeWriteMock();
        safeWrite.mockReturnValue(false);
        const { result } = renderHook(() => useTheme());
        act(() => {
            result.current.setTheme("light");
        });
        expect(result.current.theme).toBe("light");
        expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("syncs to a storage event from another tab", async () => {
        mockMatchMedia(false);
        const useTheme = await importUseTheme();
        const { result } = renderHook(() => useTheme());
        act(() => {
            localStorage.setItem(THEME_KEY, "dark");
            globalThis.dispatchEvent(
                new StorageEvent("storage", { key: THEME_KEY }),
            );
        });
        expect(result.current.theme).toBe("dark");
    });

    it("ignores storage events for unrelated keys", async () => {
        mockMatchMedia(false);
        const useTheme = await importUseTheme();
        const { result } = renderHook(() => useTheme());
        act(() => {
            localStorage.setItem(THEME_KEY, "dark");
            globalThis.dispatchEvent(
                new StorageEvent("storage", { key: "unrelated" }),
            );
        });
        expect(result.current.theme).toBe("system");
    });

    it("re-applies the resolved theme when the OS color-scheme changes (while system)", async () => {
        const { fire } = mockMatchMedia(false);
        const useTheme = await importUseTheme();
        renderHook(() => useTheme());
        expect(document.documentElement.classList.contains("dark")).toBe(false);
        act(() => {
            fire(true);
        });
        expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("does not subscribe to OS changes when a fixed theme is selected", async () => {
        localStorage.setItem(THEME_KEY, "dark");
        const { mql } = mockMatchMedia(false);
        const useTheme = await importUseTheme();
        renderHook(() => useTheme());
        expect(mql.addEventListener).not.toHaveBeenCalled();
    });

    it("subscribes to the OS color-scheme change while on 'system'", async () => {
        const { mql } = mockMatchMedia(false);
        const useTheme = await importUseTheme();
        renderHook(() => useTheme());
        expect(mql.addEventListener).toHaveBeenCalledWith(
            "change",
            expect.any(Function),
        );
    });
});
