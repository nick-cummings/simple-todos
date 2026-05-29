import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SortMenu } from "./SortMenu";

const LABELS = {
  count: "Count",
  name: "Name",
  recent: "Recent",
} as const;

describe("SortMenu", () => {
  it("renders an option for every label", () => {
    render(
      <SortMenu
        ariaLabel="Sort labels by"
        labels={LABELS}
        onChange={vi.fn()}
        value="recent"
      />,
    );
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Count",
      "Name",
      "Recent",
    ]);
  });

  it("shows the active value's label in the visible text", () => {
    render(
      <SortMenu
        ariaLabel="Sort labels by"
        labels={LABELS}
        onChange={vi.fn()}
        value="name"
      />,
    );
    expect(screen.getByText("Name", { selector: "span" })).toBeInTheDocument();
  });

  it("fires onChange with the selected key", () => {
    const onChange = vi.fn();
    render(
      <SortMenu
        ariaLabel="Sort labels by"
        labels={LABELS}
        onChange={onChange}
        value="recent"
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "count" },
    });
    expect(onChange).toHaveBeenCalledWith("count");
  });

  it("applies the given ariaLabel to the select", () => {
    render(
      <SortMenu
        ariaLabel="Sort by"
        labels={LABELS}
        onChange={vi.fn()}
        value="recent"
      />,
    );
    expect(screen.getByLabelText("Sort by")).toBeInTheDocument();
  });

  it("reflects the controlled value as the select's value", () => {
    render(
      <SortMenu
        ariaLabel="Sort labels by"
        labels={LABELS}
        onChange={vi.fn()}
        value="name"
      />,
    );
    expect(screen.getByRole<HTMLSelectElement>("combobox").value).toBe("name");
  });

  it("renders the default variant classes when no variant is given", () => {
    const { container } = render(
      <SortMenu
        ariaLabel="Sort by"
        labels={LABELS}
        onChange={vi.fn()}
        value="recent"
      />,
    );
    const label = container.querySelector("label");
    expect(label).toHaveClass("h-11", "rounded-lg");
  });

  it("renders the compact variant classes when requested", () => {
    const { container } = render(
      <SortMenu
        ariaLabel="Sort labels by"
        labels={LABELS}
        onChange={vi.fn()}
        value="recent"
        variant="compact"
      />,
    );
    const label = container.querySelector("label");
    expect(label).toHaveClass("h-9", "rounded-full", "text-[13px]");
  });
});
