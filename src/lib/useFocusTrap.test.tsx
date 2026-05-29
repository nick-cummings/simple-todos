import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it } from "vitest";

import { useFocusTrap } from "./useFocusTrap";

// Document tab order is: outside, first, middle, last. With the trap
// active, focus is confined to first/middle/last; without it, tabbing
// wraps through `outside` as well.
function Harness({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, enabled);
  return (
    <div>
      <button data-testid="outside" type="button">
        outside
      </button>
      <div data-testid="trap" ref={ref}>
        <button data-testid="first" type="button">
          first
        </button>
        <button data-testid="middle" type="button">
          middle
        </button>
        <button data-testid="last" type="button">
          last
        </button>
      </div>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("pulls focus into the container on activation", () => {
    const { getByTestId, rerender } = render(<Harness enabled={false} />);
    getByTestId("outside").focus();
    expect(getByTestId("outside")).toHaveFocus();
    rerender(<Harness enabled />);
    expect(getByTestId("first")).toHaveFocus();
  });

  it("wraps Tab from the last focusable back to the first", async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Harness enabled />);
    getByTestId("last").focus();
    await user.tab();
    expect(getByTestId("first")).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable to the last", async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Harness enabled />);
    getByTestId("first").focus();
    await user.tab({ shift: true });
    expect(getByTestId("last")).toHaveFocus();
  });

  it("lets Tab move between elements inside the container", async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Harness enabled />);
    getByTestId("first").focus();
    await user.tab();
    expect(getByTestId("middle")).toHaveFocus();
  });

  it("restores focus to the previously-focused element on cleanup", () => {
    const { getByTestId, rerender } = render(<Harness enabled={false} />);
    const outside = getByTestId("outside");
    outside.focus();
    rerender(<Harness enabled />);
    expect(getByTestId("first")).toHaveFocus();
    rerender(<Harness enabled={false} />);
    expect(outside).toHaveFocus();
  });

  it("does not trap while disabled", async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Harness enabled={false} />);
    getByTestId("last").focus();
    await user.tab();
    // Without the trap, focus is free to leave the container instead of
    // wrapping back to the first element.
    expect(getByTestId("first")).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });
});
