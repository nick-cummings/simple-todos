import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LABELS_STORAGE_KEY, type Label } from "@/lib/labels";
import { STORAGE_KEY, type Todo } from "@/lib/todos";

function seedLabels(labels: Label[]) {
  localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(labels));
}
function seedTodos(todos: Todo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

async function renderManager(opts: { onClose?: () => void } = {}) {
  vi.resetModules();
  const LabelsManager = (await import("./LabelsManager")).default;
  const onClose = opts.onClose ?? vi.fn();
  const utils = render(<LabelsManager open onClose={onClose} />);
  return { user: userEvent.setup(), onClose, ...utils };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<LabelsManager>", () => {
  it("renders nothing when not open", async () => {
    vi.resetModules();
    const LabelsManager = (await import("./LabelsManager")).default;
    const { container } = render(
      <LabelsManager open={false} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the empty state when no labels exist", async () => {
    await renderManager();
    expect(screen.getByText(/no labels yet/i)).toBeInTheDocument();
    // Header still shows the count (0).
    expect(screen.getByRole("heading", { name: /labels/i })).toHaveTextContent(
      "Labels(0)",
    );
  });

  it("renders existing labels with their todo counts", async () => {
    seedLabels([
      { name: "work", color: "blue", createdAt: 1 },
      { name: "home", color: "red", createdAt: 2 },
    ]);
    seedTodos([
      {
        id: "1",
        title: "x",
        completed: false,
        labels: ["work", "home"],
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "2",
        title: "y",
        completed: false,
        labels: ["work"],
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    await renderManager();
    // Label pills + counts; "work" appears twice across todos (count 2),
    // "home" once (count 1). The "Labels (N)" header also shows "(2)",
    // so the row count "(2)" appears twice — pick the row inside the
    // scrolling list.
    const workRow = screen.getByText("work").closest("[data-label-name]");
    const homeRow = screen.getByText("home").closest("[data-label-name]");
    expect(workRow).not.toBeNull();
    expect(workRow!).toHaveTextContent("(2)");
    expect(homeRow!).toHaveTextContent("(1)");
  });

  it("closes (after exit animation) when the X button is clicked", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onClose = vi.fn();
    const { user } = await renderManager({ onClose });
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    await vi.advanceTimersByTimeAsync(250);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onClose = vi.fn();
    const { user } = await renderManager({ onClose });
    await user.keyboard("{Escape}");
    await vi.advanceTimersByTimeAsync(250);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("adds a new label via the footer form", async () => {
    const { user } = await renderManager();
    const input = screen.getByPlaceholderText(/new label name/i);
    await user.type(input, "Errands");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(screen.getByText("Errands")).toBeInTheDocument();
    // And it persisted to localStorage.
    const stored = JSON.parse(localStorage.getItem(LABELS_STORAGE_KEY) || "[]");
    expect(stored.map((l: Label) => l.name)).toContain("Errands");
  });

  it("renames a label via Edit → input → Enter", async () => {
    seedLabels([{ name: "work", color: "blue", createdAt: 1 }]);
    const { user } = await renderManager();
    await user.click(screen.getByRole("button", { name: /edit work/i }));
    const editInput = screen.getByDisplayValue("work");
    await user.clear(editInput);
    await user.type(editInput, "Workspace{Enter}");
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.queryByText("work")).not.toBeInTheDocument();
  });

  it("reverts the rename on Escape", async () => {
    seedLabels([{ name: "work", color: "blue", createdAt: 1 }]);
    const { user } = await renderManager();
    await user.click(screen.getByRole("button", { name: /edit work/i }));
    const editInput = screen.getByDisplayValue("work");
    await user.clear(editInput);
    await user.type(editInput, "abandoned{Escape}");
    // The original "work" pill is back; editing input is gone.
    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("abandoned")).not.toBeInTheDocument();
  });

  it("does not rename when the field is empty (commit guard)", async () => {
    seedLabels([{ name: "work", color: "blue", createdAt: 1 }]);
    const { user } = await renderManager();
    await user.click(screen.getByRole("button", { name: /edit work/i }));
    const editInput = screen.getByDisplayValue("work");
    await user.clear(editInput);
    // Save button (check icon) — but commit() ignores empty drafts.
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(screen.getByText("work")).toBeInTheDocument();
  });

  it("triggers delete via the trash icon → 'Delete' peek button", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seedLabels([{ name: "work", color: "blue", createdAt: 1 }]);
    const { user } = await renderManager();
    // First click of the row trash icon enters "peek" state.
    await user.click(screen.getByRole("button", { name: /^delete work$/i }));
    // The hidden "Delete" confirm button is now interactive.
    const confirm = screen.getByRole("button", {
      name: /confirm delete work/i,
    });
    await user.click(confirm);
    // Exit animation runs for ~260ms before onDelete fires.
    await vi.advanceTimersByTimeAsync(300);
    // Label is gone from the registry.
    expect(screen.queryByText("work")).not.toBeInTheDocument();
  });

  it("sorts labels alphabetically when Name is chosen", async () => {
    seedLabels([
      { name: "zeta", color: "blue", createdAt: 3 },
      { name: "alpha", color: "red", createdAt: 1 },
      { name: "mu", color: "green", createdAt: 2 },
    ]);
    const { user } = await renderManager();
    const select = screen.getByRole("combobox", { name: /sort labels by/i });
    await user.selectOptions(select, "name");
    const names = screen
      .getAllByText(/^(alpha|mu|zeta)$/)
      .map((el) => el.textContent);
    expect(names).toEqual(["alpha", "mu", "zeta"]);
  });

  it("closes when the backdrop is clicked", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onClose = vi.fn();
    const { user } = await renderManager({ onClose });
    // The backdrop is the outermost dialog div; clicking it triggers
    // close because e.target === e.currentTarget.
    const dialog = screen.getByRole("dialog", { name: /manage labels/i });
    await user.pointer({ keys: "[MouseLeft>]", target: dialog });
    await user.pointer({ keys: "[/MouseLeft]", target: dialog });
    await vi.advanceTimersByTimeAsync(250);
    expect(onClose).toHaveBeenCalled();
  });

  it("dismisses with the 'Done' button", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onClose = vi.fn();
    const { user } = await renderManager({ onClose });
    await user.click(screen.getByRole("button", { name: /^done$/i }));
    await vi.advanceTimersByTimeAsync(250);
    expect(onClose).toHaveBeenCalled();
  });

});

describe("<LabelsManager> — interactions with sort menu visibility", () => {
  it("hides the Sort menu when there are no labels", async () => {
    await renderManager();
    expect(
      screen.queryByRole("combobox", { name: /sort labels by/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the Sort menu once at least one label exists", async () => {
    seedLabels([{ name: "x", color: "gray", createdAt: 1 }]);
    await renderManager();
    expect(
      screen.getByRole("combobox", { name: /sort labels by/i }),
    ).toBeInTheDocument();
  });
});

