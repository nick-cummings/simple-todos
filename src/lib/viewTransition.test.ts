import { afterEach, describe, expect, it, vi } from "vitest";

import { withViewTransition } from "./viewTransition";

afterEach(() => {
  vi.restoreAllMocks();
  // Restore any prototype patches we made on document/window.
  delete (document as unknown as { startViewTransition?: unknown })
    .startViewTransition;
});

describe("withViewTransition", () => {
  it("runs the callback synchronously when the API is unsupported", () => {
    // happy-dom doesn't implement startViewTransition by default.
    const cb = vi.fn();
    withViewTransition(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("runs the callback synchronously when prefers-reduced-motion is set", () => {
    (
      document as unknown as {
        startViewTransition: (cb: () => void) => unknown;
      }
    ).startViewTransition = vi.fn();
    vi.spyOn(globalThis, "matchMedia").mockImplementation(
      (q) =>
        ({
          addEventListener: vi.fn(),
          matches: q === "(prefers-reduced-motion: reduce)",
          media: q,
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const cb = vi.fn();
    withViewTransition(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(
      (document as unknown as { startViewTransition: unknown })
        .startViewTransition,
    ).not.toHaveBeenCalled?.();
  });

  it("delegates to document.startViewTransition when supported", () => {
    const inner = vi.fn();
    const startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    (
      document as unknown as {
        startViewTransition: (cb: () => void) => unknown;
      }
    ).startViewTransition = startViewTransition;
    vi.spyOn(globalThis, "matchMedia").mockImplementation(
      () =>
        ({
          addEventListener: vi.fn(),
          matches: false,
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    withViewTransition(inner);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(1);
  });
});
