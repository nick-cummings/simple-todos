import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_KEY } from "./theme";

async function importUseTheme() {
  vi.resetModules();
  return (await import("./useTheme")).useTheme;
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
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  const mql = {
    get matches() {
      return state.matches;
    },
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn((_: string, cb: (e: { matches: boolean }) => void) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  };
  vi.spyOn(window, "matchMedia").mockImplementation(
    () => mql as unknown as MediaQueryList,
  );
  return {
    mql,
    fire: (m: boolean) => {
      state.matches = m;
      listeners.forEach((cb) => cb({ matches: m }));
    },
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

  it("setTheme survives a localStorage write that throws", async () => {
    mockMatchMedia(false);
    const useTheme = await importUseTheme();
    const { result } = renderHook(() => useTheme());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
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
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY }));
    });
    expect(result.current.theme).toBe("dark");
  });

  it("ignores storage events for unrelated keys", async () => {
    mockMatchMedia(false);
    const useTheme = await importUseTheme();
    const { result } = renderHook(() => useTheme());
    act(() => {
      localStorage.setItem(THEME_KEY, "dark");
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
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
