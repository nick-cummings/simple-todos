import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import TodoCard from "./TodoCard";
import { makeTodo } from "@/test-utils/factories";
import { toISODate } from "@/lib/dates";

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

describe("<TodoCard>", () => {
  it("renders the title and respects the completed visual state", () => {
    const todo = makeTodo({ title: "Buy milk", completed: true });
    render(<TodoCard todo={todo} onToggle={() => {}} onOpen={() => {}} />);
    const title = screen.getByText("Buy milk");
    expect(title).toBeInTheDocument();
    expect(title).toHaveAttribute("data-completed", "true");
  });

  it("renders label pills for each label", () => {
    const todo = makeTodo({ labels: ["work", "urgent"] });
    render(<TodoCard todo={todo} onToggle={() => {}} onOpen={() => {}} />);
    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("calls onOpen when the title area is clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const todo = makeTodo({ title: "tap me" });
    render(<TodoCard todo={todo} onToggle={() => {}} onOpen={onOpen} />);
    await user.click(screen.getByText("tap me"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("calls onToggle (and NOT onOpen) when the checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    const todo = makeTodo();
    render(<TodoCard todo={todo} onToggle={onToggle} onOpen={onOpen} />);
    await user.click(screen.getByRole("checkbox", { name: /mark as done/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("uses 'Mark as open' label when already completed", () => {
    const todo = makeTodo({ completed: true });
    render(<TodoCard todo={todo} onToggle={() => {}} onOpen={() => {}} />);
    expect(
      screen.getByRole("checkbox", { name: /mark as open/i }),
    ).toBeInTheDocument();
  });

  it("shows 'Overdue' when due date is in the past and not completed", () => {
    const past = isoOffset(-3);
    const todo = makeTodo({ dueDate: past, completed: false });
    render(<TodoCard todo={todo} onToggle={() => {}} onOpen={() => {}} />);
    expect(screen.getByText(/Overdue/)).toBeInTheDocument();
  });

  it("hides 'Overdue' once the todo is completed", () => {
    const past = isoOffset(-3);
    const todo = makeTodo({ dueDate: past, completed: true });
    render(<TodoCard todo={todo} onToggle={() => {}} onOpen={() => {}} />);
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  });

  it("does not render Overdue for a future due date", () => {
    const future = isoOffset(5);
    const todo = makeTodo({ dueDate: future });
    render(<TodoCard todo={todo} onToggle={() => {}} onOpen={() => {}} />);
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  });

  it("renders the relative-time createdAt text", () => {
    const todo = makeTodo({ createdAt: Date.now() });
    render(<TodoCard todo={todo} onToggle={() => {}} onOpen={() => {}} />);
    // relativeTime returns "now", "Xm ago", etc.
    expect(screen.getByText(/now|ago|just/i)).toBeInTheDocument();
  });
});
