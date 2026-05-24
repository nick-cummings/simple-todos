import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import InstallBanner from "./InstallBanner";

describe("<InstallBanner>", () => {
  it("renders install copy referencing Share + Add to Home Screen", () => {
    render(<InstallBanner onDismiss={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /install simple todos/i }),
    ).toBeVisible();
    expect(screen.getByText(/share/i)).toBeInTheDocument();
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
  });

  it("explains why install matters (push notifications)", () => {
    render(<InstallBanner onDismiss={vi.fn()} />);
    expect(
      screen.getByText(/push notifications only work in the installed/i),
    ).toBeInTheDocument();
  });

  it("calls onDismiss when the Dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<InstallBanner onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("has a labeled region for assistive tech", () => {
    render(<InstallBanner onDismiss={vi.fn()} />);
    expect(
      screen.getByRole("region", { name: /install simple todos as an app/i }),
    ).toBeInTheDocument();
  });
});
