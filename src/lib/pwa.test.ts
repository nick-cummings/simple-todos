import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isIOS, isStandalonePWA } from "./pwa";

const ORIGINAL_UA = navigator.userAgent;
const ORIGINAL_TOUCH = navigator.maxTouchPoints;

function setMaxTouchPoints(n: number) {
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    get: () => n,
  });
}
function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    get: () => ua,
  });
}

beforeEach(() => {
  setUserAgent(ORIGINAL_UA);
  setMaxTouchPoints(ORIGINAL_TOUCH);
});

afterEach(() => {
  vi.restoreAllMocks();
  // Reset navigator.standalone if a test set it.
  delete (navigator as Navigator & { standalone?: boolean }).standalone;
});

describe("isIOS", () => {
  it("true for iPhone Safari UA", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1",
    );
    expect(isIOS()).toBe(true);
  });

  it("true for iPad UA", () => {
    setUserAgent("Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X)");
    expect(isIOS()).toBe(true);
  });

  it("true for iPadOS 13+ which reports as Macintosh with touch", () => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit");
    setMaxTouchPoints(5);
    expect(isIOS()).toBe(true);
  });

  it("false for a real Mac (Macintosh UA, no touch)", () => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit");
    setMaxTouchPoints(0);
    expect(isIOS()).toBe(false);
  });

  it("false for desktop Chrome", () => {
    setUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/120");
    setMaxTouchPoints(0);
    expect(isIOS()).toBe(false);
  });
});

describe("isStandalonePWA", () => {
  it("true when navigator.standalone === true (iOS Safari installed PWA)", () => {
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: true,
    });
    expect(isStandalonePWA()).toBe(true);
  });

  it("true when matchMedia display-mode standalone matches", () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(
      (q: string): MediaQueryList =>
        ({
          addEventListener: vi.fn(),
          addListener: vi.fn(),
          dispatchEvent: vi.fn(),
          matches: q.includes("standalone"),
          media: q,
          onchange: null,
          removeEventListener: vi.fn(),
          removeListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    expect(isStandalonePWA()).toBe(true);
  });

  it("false when neither signal is present", () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(
      (q: string): MediaQueryList =>
        ({
          addEventListener: vi.fn(),
          addListener: vi.fn(),
          dispatchEvent: vi.fn(),
          matches: false,
          media: q,
          onchange: null,
          removeEventListener: vi.fn(),
          removeListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    expect(isStandalonePWA()).toBe(false);
  });
});
