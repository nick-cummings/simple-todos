import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const ORIGINAL_UA = navigator.userAgent;

function setIOSUA() {
  setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  );
}

function setNonIOSUA() {
  setUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/120");
}

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    get: () => ua,
  });
}

beforeEach(() => {
  localStorage.clear();
  setUserAgent(ORIGINAL_UA);
  delete (navigator as Navigator & { standalone?: boolean }).standalone;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Re-import the hook inside each test so module state (none in this
// case, but defensively) and the env defaults pick up cleanly.
async function importHook() {
  vi.resetModules();
  const mod = await import("./useInstallPrompt");
  return mod;
}

describe("useInstallPrompt", () => {
  it("prompts on iOS Safari when not installed and not previously dismissed", async () => {
    setIOSUA();
    const { useInstallPrompt } = await importHook();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.shouldPrompt).toBe(true);
  });

  it("does NOT prompt on non-iOS browsers", async () => {
    setNonIOSUA();
    const { useInstallPrompt } = await importHook();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.shouldPrompt).toBe(false);
  });

  it("does NOT prompt when the app is already installed (navigator.standalone)", async () => {
    setIOSUA();
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: true,
    });
    const { useInstallPrompt } = await importHook();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.shouldPrompt).toBe(false);
  });

  it("does NOT prompt when previously dismissed (key set to '1')", async () => {
    setIOSUA();
    const { INSTALL_PROMPT_DISMISSED_KEY, useInstallPrompt } =
      await importHook();
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "1");
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.shouldPrompt).toBe(false);
  });

  it("dismiss persists to localStorage and flips shouldPrompt to false", async () => {
    setIOSUA();
    const { INSTALL_PROMPT_DISMISSED_KEY, useInstallPrompt } =
      await importHook();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.shouldPrompt).toBe(true);
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.shouldPrompt).toBe(false);
    expect(localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY)).toBe("1");
  });

  it("starts with shouldPrompt=false to keep SSR + first paint stable", async () => {
    // Even on iOS, the synchronous render-time value is false. The
    // upgrade happens in the post-mount effect. This guarantees the
    // server-rendered HTML and the client's first paint match, so we
    // don't trigger hydration mismatches in production.
    setIOSUA();
    const { useInstallPrompt } = await importHook();
    let firstRenderValue: boolean | undefined;
    renderHook(() => {
      const state = useInstallPrompt();
      firstRenderValue ??= state.shouldPrompt;
      return state;
    });
    expect(firstRenderValue).toBe(false);
  });
});
