import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyResolvedTheme,
  isTheme,
  readStoredTheme,
  resolveTheme,
  systemPrefersDark,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_KEY,
} from "./theme";

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  vi.restoreAllMocks();
});

describe("isTheme", () => {
  it("accepts known theme values", () => {
    expect(isTheme("system")).toBe(true);
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isTheme("auto")).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme(0)).toBe(false);
  });
});

describe("readStoredTheme", () => {
  it("returns 'system' when nothing is stored", () => {
    expect(readStoredTheme()).toBe("system");
  });
  it("returns the stored value when valid", () => {
    localStorage.setItem(THEME_KEY, "dark");
    expect(readStoredTheme()).toBe("dark");
  });
  it("returns 'system' when the stored value is invalid", () => {
    localStorage.setItem(THEME_KEY, "purple");
    expect(readStoredTheme()).toBe("system");
  });
  it("returns 'system' when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredTheme()).toBe("system");
  });
});

describe("systemPrefersDark", () => {
  it("returns the matchMedia result for prefers-color-scheme: dark", () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation((q) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: q === "(prefers-color-scheme: dark)",
      media: q,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    expect(systemPrefersDark()).toBe(true);
  });
});

describe("resolveTheme", () => {
  it("returns 'light'/'dark' verbatim", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });
  it("for 'system', defers to systemPrefersDark", () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(
      () =>
        ({
          addEventListener: vi.fn(),
          matches: true,
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    expect(resolveTheme("system")).toBe("dark");
  });
});

describe("applyResolvedTheme", () => {
  it("adds the 'dark' class and sets color-scheme for dark", () => {
    applyResolvedTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
  it("removes the 'dark' class for light", () => {
    document.documentElement.classList.add("dark");
    applyResolvedTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});

describe("THEME_BOOTSTRAP_SCRIPT", () => {
  it("references the storage key so the inline script reads the same value", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(THEME_KEY));
  });
  it("does not contain any user-controllable content (template safety)", () => {
    // Sanity — the script is a compile-time constant. If anything ever
    // templated user input into it we'd want this assertion to fail loudly.
    expect(THEME_BOOTSTRAP_SCRIPT).not.toMatch(/\$\{/);
  });
});
