import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UndoToast from "./UndoToast";

function renderToast(props: {
  message?: null | string;
  onExpire?: () => void;
  onUndo?: () => void;
  windowMs?: number;
}) {
  const onUndo = props.onUndo ?? vi.fn();
  const onExpire = props.onExpire ?? vi.fn();
  const utils = render(
    <UndoToast
      message={props.message ?? null}
      onExpire={onExpire}
      onUndo={onUndo}
      windowMs={props.windowMs}
    />,
  );
  return { onExpire, onUndo, ...utils };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<UndoToast>", () => {
  it("renders nothing when message is null", () => {
    renderToast({ message: null });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("pops in when message is set", () => {
    renderToast({ message: "Deleted X" });
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent(/Deleted X/);
    expect(toast).toHaveClass(/animate-pop-in/);
  });

  it("calls onUndo when the Undo button is clicked, then plays the exit animation", async () => {
    const onUndo = vi.fn();
    const onExpire = vi.fn();
    renderToast({ message: "Deleted X", onExpire, onUndo });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("button", { name: /undo/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    // Exit animation playing — class flips.
    expect(screen.getByRole("status")).toHaveClass(/animate-pop-out/);
    // After EXIT_MS (220ms), the toast unmounts.
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // Undo doesn't trigger onExpire.
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("calls onExpire after the window elapses", async () => {
    const onUndo = vi.fn();
    const onExpire = vi.fn();
    renderToast({ message: "Deleted X", onExpire, onUndo, windowMs: 1000 });
    expect(onExpire).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    // Window elapsed; exit animation starts.
    expect(screen.getByRole("status")).toHaveClass(/animate-pop-out/);
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("does not fire onExpire when the user clicks Undo before expiry", async () => {
    const onExpire = vi.fn();
    renderToast({ message: "Deleted X", onExpire, windowMs: 1000 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await user.click(screen.getByRole("button", { name: /undo/i }));
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("replaces the visible message when a new one arrives mid-window", async () => {
    const onExpire = vi.fn();
    const { rerender } = renderToast({
      message: "Deleted A",
      onExpire,
      windowMs: 1000,
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    rerender(
      <UndoToast
        message="Deleted B"
        onExpire={onExpire}
        onUndo={() => undefined}
        windowMs={1000}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/Deleted B/);
    // The new window is fresh — should NOT expire after the remaining
    // 600ms from the previous window.
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(onExpire).not.toHaveBeenCalled();
    // It does expire after a fresh full window.
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
