import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import RemindersGate from "./RemindersGate";

describe("<RemindersGate>", () => {
  it("calls onEnable when Enable reminders is clicked", async () => {
    const onEnable = vi.fn(async () => true);
    render(<RemindersGate onEnable={onEnable} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /enable reminders/i }));
    expect(onEnable).toHaveBeenCalledTimes(1);
  });

  it("dismisses itself after onEnable resolves (granted or not)", async () => {
    const onEnable = vi.fn(async () => false);
    const { container } = render(<RemindersGate onEnable={onEnable} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /enable reminders/i }));
    expect(container.firstChild).toBeNull();
  });

  it("dismisses without calling onEnable when 'Not now' is clicked", async () => {
    const onEnable = vi.fn();
    const { container } = render(<RemindersGate onEnable={onEnable} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /not now/i }));
    expect(onEnable).not.toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
  });

  it("shows a busy state while onEnable is pending", async () => {
    const noop: (v: boolean) => void = () => undefined;
    let resolveIt: (v: boolean) => void = noop;
    const onEnable = vi.fn(() => new Promise<boolean>((r) => (resolveIt = r)));
    render(<RemindersGate onEnable={onEnable} />);
    const user = userEvent.setup();
    // Click triggers async work; spinner label shows.
    void user.click(screen.getByRole("button", { name: /enable reminders/i }));
    expect(
      await screen.findByRole("button", { name: /enabling…/i }),
    ).toBeDisabled();
    resolveIt(true);
  });
});
