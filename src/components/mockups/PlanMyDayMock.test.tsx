import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import PlanMyDayMock from "./PlanMyDayMock";

function orderedTitles(list: HTMLElement) {
  return within(list)
    .getAllByRole("listitem")
    .map((li) => within(li).getByText(/^(Prep|Review|Draft|Clear|Water)/).textContent);
}

describe("PlanMyDayMock", () => {
  it("renders the stubbed proposal in its suggested order", () => {
    render(<PlanMyDayMock />);
    const list = screen.getByRole("list");
    expect(orderedTitles(list)).toEqual([
      "Prep for 10am standup",
      "Review Dana's PR",
      "Draft the Q3 planning doc",
      "Clear inbox to zero",
      "Water the plants",
    ]);
  });

  it("disables move-up on the first item and move-down on the last", () => {
    render(<PlanMyDayMock />);
    expect(
      screen.getByRole("button", { name: "Move Prep for 10am standup up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Water the plants down" }),
    ).toBeDisabled();
  });

  it("reorders an item when the user nudges it up", async () => {
    const user = userEvent.setup();
    render(<PlanMyDayMock />);
    await user.click(
      screen.getByRole("button", { name: "Move Draft the Q3 planning doc up" }),
    );
    expect(orderedTitles(screen.getByRole("list"))).toEqual([
      "Prep for 10am standup",
      "Draft the Q3 planning doc",
      "Review Dana's PR",
      "Clear inbox to zero",
      "Water the plants",
    ]);
  });

  it("shows a confirmation reflecting the edited order after accepting", async () => {
    const user = userEvent.setup();
    render(<PlanMyDayMock />);
    await user.click(
      screen.getByRole("button", { name: "Move Water the plants up" }),
    );
    await user.click(screen.getByRole("button", { name: "Accept plan" }));

    expect(screen.getByText("Plan accepted")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Accept plan" }),
    ).not.toBeInTheDocument();
    expect(orderedTitles(screen.getByRole("list"))).toEqual([
      "Prep for 10am standup",
      "Review Dana's PR",
      "Draft the Q3 planning doc",
      "Water the plants",
      "Clear inbox to zero",
    ]);
  });

  it("returns to the editable review list via 'Review again'", async () => {
    const user = userEvent.setup();
    render(<PlanMyDayMock />);
    await user.click(screen.getByRole("button", { name: "Accept plan" }));
    await user.click(screen.getByRole("button", { name: /Review again/ }));
    expect(
      screen.getByRole("button", { name: "Accept plan" }),
    ).toBeInTheDocument();
  });

  it("resets to the original proposal when regenerated", async () => {
    const user = userEvent.setup();
    render(<PlanMyDayMock />);
    await user.click(
      screen.getByRole("button", { name: "Move Review Dana's PR up" }),
    );
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(orderedTitles(screen.getByRole("list"))).toEqual([
      "Prep for 10am standup",
      "Review Dana's PR",
      "Draft the Q3 planning doc",
      "Clear inbox to zero",
      "Water the plants",
    ]);
  });
});
