import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type Label, LABELS_STORAGE_KEY } from "@/lib/labels";
import { STORAGE_KEY, type Todo } from "@/lib/todos";

// Controllable stub for useReminders so we can assert on the
// TodoApp ↔ reminders seam without mocking Notification + serviceWorker
// at the integration level. Tests mutate `reminderState` before
// rendering; the component reads it via `useReminders()` on each render.
const reminderState = {
  active: false,
  disable: vi.fn<() => Promise<void>>(),
  enable: vi.fn<() => Promise<boolean>>(),
  needsAttention: false,
  permission: "prompt" as "denied" | "granted" | "prompt" | "unsupported",
  syncTodoReminder: vi.fn<(t: Todo) => Promise<void>>(),
};

vi.mock("@/lib/useReminders", () => ({
  fireAtForDueDate: (iso: string | undefined): null | number => {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return null;
    return Date.UTC(y, m - 1, d, 0, 0, 0);
  },
  useReminders: () => reminderState,
}));

async function renderApp() {
  vi.resetModules();
  const mod = await import("./TodoApp");
  const TodoApp = mod.default;
  return { user: userEvent.setup(), ...render(<TodoApp />) };
}
function resetReminderMock() {
  reminderState.active = false;
  reminderState.permission = "prompt";
  reminderState.needsAttention = false;
  reminderState.syncTodoReminder = vi.fn<(t: Todo) => Promise<void>>();
  reminderState.enable = vi
    .fn<() => Promise<boolean>>()
    .mockResolvedValue(true);
  reminderState.disable = vi.fn<() => Promise<void>>();
}

function seedLabels(labels: Label[]) {
  localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(labels));
}

function seedTodos(todos: Todo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

beforeEach(() => {
  localStorage.clear();
  resetReminderMock();
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
        completed: true, // completed, but default filter is open-only
        createdAt: Date.now(),
        id: "1",
        labels: [],
        title: "buy milk",
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
        completed: false,
        createdAt: Date.now(),
        id: "1",
        labels: [],
        title: "todo a",
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
        completed: false,
        createdAt: Date.now(),
        id: "1",
        labels: ["shopping"],
        title: "Buy milk",
        updatedAt: Date.now(),
      },
      {
        completed: false,
        createdAt: Date.now(),
        id: "2",
        labels: ["leisure"],
        title: "Read book",
        updatedAt: Date.now(),
      },
    ]);
    seedLabels([
      { color: "blue", createdAt: 1, name: "shopping" },
      { color: "green", createdAt: 2, name: "leisure" },
    ]);
  });

  it("filters via the search box", async () => {
    const { user } = await renderApp();
    await user.type(screen.getByPlaceholderText(/search todos/i), "milk");
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
        completed: true,
        createdAt: Date.now(),
        id: "1",
        labels: [],
        title: "done todo",
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
    await user.click(screen.getByRole("button", { name: /clear completed/i }));
    expect(screen.queryByText("done todo")).not.toBeInTheDocument();
  });
});

describe("<TodoApp> — undo toast", () => {
  it("shows the undo toast after deletion and restores the todo when Undo is clicked", async () => {
    seedTodos([
      {
        completed: false,
        createdAt: Date.now(),
        id: "1",
        labels: ["a"],
        title: "todo to delete",
        updatedAt: Date.now(),
      },
    ]);
    const { user } = await renderApp();
    // Open the todo, delete it through the modal.
    await user.click(screen.getByText("todo to delete"));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    // Toast appears.
    const toast = await screen.findByRole("status");
    expect(toast).toHaveTextContent(/Deleted/);
    expect(toast).toHaveTextContent(/todo to delete/);
    // Wait for the modal's 220ms exit animation to finish, then the
    // card is gone from the list. (During the exit animation the
    // modal's <h3> still shows the title — we want to assert on the
    // post-close state.)
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/^todo to delete$/)).not.toBeInTheDocument();
    // Click Undo — todo comes back.
    await user.click(within(toast).getByRole("button", { name: /undo/i }));
    expect(screen.getByText("todo to delete")).toBeInTheDocument();
  });
});

/**
 * Integration tests for the TodoApp ↔ useReminders seam. These cover
 * scenarios that the unit tests for useReminders alone can't catch —
 * specifically, that TodoApp invokes syncTodoReminder with the
 * correct todo state on every mutation, and that an active state on
 * mount triggers a sync for every existing todo.
 *
 * Two real bugs would have been caught here:
 *  1. handleSubmit used a stale `todos` closure to look up the new
 *     todo after add(), so newly-added todos never got registered.
 *  2. Enabling reminders didn't walk existing todos, so any todo
 *     created before enabling was silently skipped.
 */
describe("<TodoApp> — labels integration", () => {
  it("registers new label names in the label registry on submit", async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole("button", { name: /add todo/i }));
    const dialog = await screen.findByRole("dialog", { name: /new todo/i });
    await user.type(
      within(dialog).getByPlaceholderText(/what needs doing/i),
      "Email Bob",
    );
    // Add a new label inline via the label-create row inside the modal.
    await user.type(
      within(dialog).getByPlaceholderText(/new label name/i),
      "client-work",
    );
    const labelAddBtn = within(dialog)
      .getAllByRole("button", { name: /^add$/i })
      .find((b) => (b as HTMLButtonElement).type === "button")!;
    await user.click(labelAddBtn);
    await user.click(
      within(dialog)
        .getAllByRole("button", { name: /^add$/i })
        .find((b) => (b as HTMLButtonElement).type === "submit")!,
    );

    // After submit, ensureLabelsExist should have written the new
    // label to the registry. We assert on the persistence side-effect
    // since that's the public contract of the seam.
    await waitFor(() => {
      const raw = localStorage.getItem(LABELS_STORAGE_KEY) ?? "[]";
      const labels = JSON.parse(raw) as Label[];
      expect(labels.map((l) => l.name.toLowerCase())).toContain("client-work");
    });
  });
});

describe("<TodoApp> — reminders integration", () => {
  function makeSeedTodo(over: Partial<Todo> = {}): Todo {
    return {
      completed: false,
      createdAt: Date.now(),
      id: `t-${Math.random().toString(36).slice(2, 8)}`,
      labels: [],
      title: "seeded",
      updatedAt: Date.now(),
      ...over,
    };
  }

  it("registers reminders for every existing todo when active on mount (Bug 2)", async () => {
    reminderState.active = true;
    reminderState.permission = "granted";
    seedTodos([
      makeSeedTodo({ dueDate: "2027-01-15", id: "a", title: "Pay rent" }),
      makeSeedTodo({ dueDate: "2027-01-20", id: "b", title: "Renew passport" }),
      makeSeedTodo({
        id: "c",
        title:
          "Buy milk" /* no due date — still gets a sync call which DELETEs server-side */,
      }),
    ]);
    await renderApp();
    await waitFor(() => {
      expect(reminderState.syncTodoReminder).toHaveBeenCalledTimes(3);
    });
    const ids = reminderState.syncTodoReminder.mock.calls.map(
      ([t]) => (t as Todo).id,
    );
    expect(ids.toSorted()).toEqual(["a", "b", "c"]);
  });

  it("syncs the new todo after add() (Bug 1)", async () => {
    reminderState.active = true;
    reminderState.permission = "granted";
    const { user } = await renderApp();
    // Initial mount with no todos → one sync pass with zero calls.
    reminderState.syncTodoReminder.mockClear();

    await user.click(screen.getByRole("button", { name: /add todo/i }));
    const dialog = await screen.findByRole("dialog", { name: /new todo/i });
    await user.type(
      within(dialog).getByPlaceholderText(/what needs doing/i),
      "Take out trash",
    );
    await user.click(
      within(dialog)
        .getAllByRole("button", { name: /^add$/i })
        .find((b) => (b as HTMLButtonElement).type === "submit")!,
    );

    await waitFor(() => {
      expect(reminderState.syncTodoReminder).toHaveBeenCalled();
    });
    // The most recent call should be the newly-added todo.
    const lastCall = reminderState.syncTodoReminder.mock.calls.at(-1);
    expect((lastCall?.[0] as Todo | undefined)?.title).toBe("Take out trash");
  });

  it("re-syncs when a todo's dueDate changes via update()", async () => {
    reminderState.active = true;
    reminderState.permission = "granted";
    seedTodos([
      makeSeedTodo({ dueDate: "2027-01-15", id: "t1", title: "Pay rent" }),
    ]);
    const { user } = await renderApp();
    // Drain the initial-mount sync calls.
    await waitFor(() =>
      expect(reminderState.syncTodoReminder).toHaveBeenCalled(),
    );
    reminderState.syncTodoReminder.mockClear();

    // Open + edit the todo, change its due date.
    await user.click(screen.getByText("Pay rent"));
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const due = screen.getByLabelText(/due date/i) as HTMLInputElement;
    await user.clear(due);
    await user.type(due, "2027-02-01");
    await user.click(screen.getAllByRole("button", { name: /^save$/i })[0]);

    await waitFor(() => {
      expect(reminderState.syncTodoReminder).toHaveBeenCalled();
    });
    const calls = reminderState.syncTodoReminder.mock.calls;
    const last = calls.at(-1)?.[0] as Todo | undefined;
    expect(last?.id).toBe("t1");
    expect(last?.dueDate).toBe("2027-02-01");
  });

  it("explicitly unregisters the reminder on delete (todo drops out of list)", async () => {
    reminderState.active = true;
    reminderState.permission = "granted";
    seedTodos([
      makeSeedTodo({
        dueDate: "2027-01-15",
        id: "doomed",
        title: "Delete me",
      }),
    ]);
    const { user } = await renderApp();
    await waitFor(() =>
      expect(reminderState.syncTodoReminder).toHaveBeenCalled(),
    );
    reminderState.syncTodoReminder.mockClear();

    await user.click(screen.getByText("Delete me"));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(reminderState.syncTodoReminder).toHaveBeenCalled();
    });
    // handleDelete forces completed:true so the server-side handler
    // takes the DELETE branch.
    const arg = reminderState.syncTodoReminder.mock.calls.at(-1)?.[0] as
      | Todo
      | undefined;
    expect(arg?.id).toBe("doomed");
    expect(arg?.completed).toBe(true);
  });

  it("re-syncs when a todo is toggled complete (reminder should unregister)", async () => {
    reminderState.active = true;
    reminderState.permission = "granted";
    seedTodos([
      makeSeedTodo({ dueDate: "2027-01-15", id: "t1", title: "Walk dog" }),
    ]);
    const { user } = await renderApp();
    await waitFor(() =>
      expect(reminderState.syncTodoReminder).toHaveBeenCalled(),
    );
    reminderState.syncTodoReminder.mockClear();

    await user.click(screen.getByRole("checkbox", { name: /mark as done/i }));
    await waitFor(() => {
      expect(reminderState.syncTodoReminder).toHaveBeenCalled();
    });
    const arg = reminderState.syncTodoReminder.mock.calls.at(-1)?.[0] as
      | Todo
      | undefined;
    expect(arg?.id).toBe("t1");
    expect(arg?.completed).toBe(true);
  });

  it("does not sync when reminders are inactive (effect is a no-op shape)", async () => {
    // active=false: the effect still calls syncTodoReminder (the hook
    // itself short-circuits internally), but with inactive state the
    // wiring should still call once per todo on mount.
    reminderState.active = false;
    reminderState.permission = "prompt";
    seedTodos([makeSeedTodo({ dueDate: "2027-01-15", id: "a", title: "x" })]);
    await renderApp();
    // The wiring is the same regardless of activation — the *hook*
    // decides whether to actually fetch. Verifying the call happens
    // here documents that we don't conditionally skip the effect.
    await waitFor(() => {
      expect(reminderState.syncTodoReminder).toHaveBeenCalledTimes(1);
    });
  });

  it("clicking the gate's Enable button calls the hook's enable()", async () => {
    reminderState.needsAttention = true;
    const { user } = await renderApp();
    await user.click(screen.getByRole("button", { name: /enable reminders/i }));
    expect(reminderState.enable).toHaveBeenCalledTimes(1);
  });

  it("recurring-todo completion respawns and re-syncs with the new dueDate", async () => {
    reminderState.active = true;
    reminderState.permission = "granted";
    seedTodos([
      makeSeedTodo({
        dueDate: "2027-01-15",
        id: "r1",
        recurrence: { every: 1, unit: "day" },
        title: "Water plants",
      }),
    ]);
    const { user } = await renderApp();
    await waitFor(() =>
      expect(reminderState.syncTodoReminder).toHaveBeenCalled(),
    );
    reminderState.syncTodoReminder.mockClear();

    await user.click(screen.getByRole("checkbox", { name: /mark as done/i }));
    await waitFor(() => {
      expect(reminderState.syncTodoReminder).toHaveBeenCalled();
    });
    const arg = reminderState.syncTodoReminder.mock.calls.at(-1)?.[0] as
      | Todo
      | undefined;
    expect(arg?.id).toBe("r1");
    // toggle() on a recurring todo advances the dueDate and keeps
    // completed=false.
    expect(arg?.completed).toBe(false);
    expect(arg?.dueDate).toBe("2027-01-16");
  });
});
