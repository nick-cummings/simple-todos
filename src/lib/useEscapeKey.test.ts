import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEscapeKey } from "./useEscapeKey";

function pressKey(key: string) {
  globalThis.dispatchEvent(new KeyboardEvent("keydown", { key }));
}

describe("useEscapeKey", () => {
  it("calls onEscape when Escape is pressed", () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(onEscape));
    pressKey("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("does not fire on other keys", () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(onEscape));
    pressKey("Enter");
    pressKey("a");
    pressKey("Tab");
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("respects the enabled flag", () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(onEscape, false));
    pressKey("Escape");
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("re-subscribes when enabled flips from false to true", () => {
    const onEscape = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useEscapeKey(onEscape, enabled),
      { initialProps: { enabled: false } },
    );
    pressKey("Escape");
    expect(onEscape).not.toHaveBeenCalled();
    rerender({ enabled: true });
    pressKey("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("removes its listener on unmount", () => {
    const onEscape = vi.fn();
    const { unmount } = renderHook(() => useEscapeKey(onEscape));
    unmount();
    pressKey("Escape");
    expect(onEscape).not.toHaveBeenCalled();
  });
});
