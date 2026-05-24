import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import StorageErrorBanner from "./StorageErrorBanner";

describe("<StorageErrorBanner>", () => {
  it("uses quota copy + offers a path to Settings when error=quota_exceeded", () => {
    render(<StorageErrorBanner error="quota_exceeded" onDismiss={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /storage is full/i }),
    ).toBeVisible();
    expect(screen.getByText(/export a backup/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open settings/i }),
    ).toHaveAttribute("href", "/settings");
  });

  it("uses 'unavailable' copy when error=unavailable", () => {
    render(<StorageErrorBanner error="unavailable" onDismiss={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /storage isn't available/i }),
    ).toBeVisible();
  });

  it("falls back to a generic message for 'unknown'", () => {
    render(<StorageErrorBanner error="unknown" onDismiss={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /couldn't save/i }),
    ).toBeVisible();
  });

  it("fires onDismiss when the Dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<StorageErrorBanner error="quota_exceeded" onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("uses role=alert so screen readers announce it", () => {
    render(<StorageErrorBanner error="quota_exceeded" onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
