import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LABELS_STORAGE_KEY, type Label } from "@/lib/labels";
import { STORAGE_KEY, type Todo } from "@/lib/todos";

function seedTodos(todos: Todo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}
function seedLabels(labels: Label[]) {
  localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(labels));
}

async function renderApp() {
  vi.resetModules();
  const TodoApp = (await import("./TodoApp")).default;
  return { user: userEvent.setup(), ...render(<TodoApp />) };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<TodoApp> — empty state", () => {
  it("shows 'No todos yet' and a CTA when there are no todos", async () => {
    await renderApp();
    expect(screen.getByText(/no todos yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add your first todo/i }),
    ).toBeInTheDocument();
  });

  it("shows 'Nothing matches' when filters hide everything", async () => {
    seedTodos([
      {
        id: "1",
        title: "buy milk",
        completed: true, // completed, but default filter is open-only
        labels: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    await renderApp();
    expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
  });
});

describe("<TodoApp> — todo CRUD via the FAB and modal", () => {
  it("creates a todo via the FAB → form → Add", async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole("button", { name: /add todo/i }));
    // The modal title field gets focus; type a title.
    const dialog = await screen.findByRole("dialog", { name: /new todo/i });
    const input = within(dialog).getByPlaceholderText(/what needs doing/i);
    await user.type(input, "Read book");
    // Two "Add" buttons exist (label-add and submit) — the submit one is
    // type="submit".
    const submitBtn = within(dialog)
      .getAllByRole("button", { name: /^add$/i })
      .find((b) => (b as HTMLButtonElement).type === "submit")!;
    await user.click(submitBtn);
    expect(await screen.findByText("Read book")).toBeInTheDocument();
  });

  it("toggles a todo's completed state via its checkbox", async () => {
    seedTodos([
      {
        id: "1",
        title: "todo a",
        completed: false,
        labels: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    const { user } = await renderApp();
    const checkbox = screen.getByRole("checkbox", { name: /mark as done/i });
    await user.click(checkbox);
    // After completing, default filter (open-only) hides it.
    expect(screen.queryByText("todo a")).not.toBeInTheDocument();
    // Toggle Done filter so it reappears.
    await user.click(screen.getByRole("button", { name: /^done/i }));
    expect(screen.getByText("todo a")).toBeInTheDocument();
  });
});

describe("<TodoApp> — search + filtering", () => {
  beforeEach(() => {
    seedTodos([
      {
        id: "1",
        title: "Buy milk",
        completed: false,
        labels: ["shopping"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: "2",
        title: "Read book",
        completed: false,
        labels: ["leisure"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    seedLabels([
      { name: "shopping", color: "blue", createdAt: 1 },
      { name: "leisure", color: "green", createdAt: 2 },
    ]);
  });

  it("filters via the search box", async () => {
    const { user } = await renderApp();
    await user.type(
      screen.getByPlaceholderText(/search todos/i),
      "milk",
    );
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.queryByText("Read book")).not.toBeInTheDocument();
  });

  it("filters by label chip and clears via 'All'", async () => {
    const { user } = await renderApp();
    await user.click(
      screen.getByRole("button", { name: /^shopping/i, pressed: false }),
    );
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.queryByText("Read book")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^all/i }));
    expect(screen.getByText("Read book")).toBeInTheDocument();
  });
});

describe("<TodoApp> — keyboard shortcuts", () => {
  it("focuses the search input on ⌘K / Ctrl+K", async () => {
    const { user } = await renderApp();
    const search = screen.getByPlaceholderText(/search todos/i);
    expect(search).not.toHaveFocus();
    await user.keyboard("{Control>}k{/Control}");
    expect(search).toHaveFocus();
  });
});

describe("<TodoApp> — clear completed", () => {
  it("shows the 'Clear completed' control only when a completed todo is visible", async () => {
    seedTodos([
      {
        id: "1",
        title: "done todo",
        completed: true,
        labels: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    const { user } = await renderApp();
    // Default filter hides completed → no Clear completed button.
    expect(
      screen.queryByRole("button", { name: /clear completed/i }),
    ).not.toBeInTheDocument();
    // Toggle the Done chip on.
    await user.click(screen.getByRole("button", { name: /^done/i }));
    expect(
      screen.getByRole("button", { name: /clear completed/i }),
    ).toBeInTheDocument();
    // Click it; todo disappears.
    await user.click(
      screen.getByRole("button", { name: /clear completed/i }),
    );
    expect(screen.queryByText("done todo")).not.toBeInTheDocument();
  });
});
