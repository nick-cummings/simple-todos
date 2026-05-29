import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFocusable } from "@/lib/useFocusTrap";
import { makeTodo } from "@/test-utils/factories";

import TodoModal from "./TodoModal";

function getSubmitButton(): HTMLButtonElement {
  return [...document.querySelectorAll("button")].find(
    (b) => b.type === "submit" && /^(Add|Save)$/i.test(b.textContent ?? ""),
  )!;
}

async function renderModal(
  props: {
    initial?: Parameters<typeof makeTodo>[0];
    onClose?: () => void;
    onDelete?: () => void;
    onSubmit?: (input: import("@/lib/todos").TodoInput) => void;
  } = {},
) {
  vi.resetModules();
  const mod = await import("./TodoModal");
  const TodoModal = mod.default;
  const initialTodo = props.initial ? makeTodo(props.initial) : undefined;
  const onSubmit = props.onSubmit ?? vi.fn();
  const onDelete = props.onDelete ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  const utils = render(
    <TodoModal
      initial={initialTodo}
      onClose={onClose}
      onDelete={onDelete}
      onSubmit={onSubmit}
      open
    />,
  );
  return {
    initial: initialTodo,
    onClose,
    onDelete,
    onSubmit,
    user: userEvent.setup(),
    ...utils,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("<TodoModal>", () => {
  it("renders nothing when open=false", async () => {
    vi.resetModules();
    const mod = await import("./TodoModal");
    const TodoModal = mod.default;
    const { container } = render(
      <TodoModal onClose={() => {}} onSubmit={() => {}} open={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("opens new-todo form with focus on the title input", async () => {
    await renderModal();
    const input = screen.getByPlaceholderText(/what needs doing/i);
    await waitFor(() => expect(input).toHaveFocus());
  });

  it("opens an existing todo in view mode and switches to edit on Edit click", async () => {
    const { user } = await renderModal({
      initial: { description: "details", title: "existing todo" },
    });
    expect(
      screen.getByRole("dialog", { name: /todo details/i }),
    ).toBeInTheDocument();
    // Description is visible (paragraph) in view mode.
    expect(screen.getByText("details")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(
      screen.getByRole("dialog", { name: /edit todo/i }),
    ).toBeInTheDocument();
  });

  it("disables submit when title is blank and enables it once typed", async () => {
    const { user } = await renderModal();
    let submit = getSubmitButton();
    expect(submit).toBeDisabled();
    await user.type(
      screen.getByPlaceholderText(/what needs doing/i),
      "Read book",
    );
    submit = getSubmitButton();
    expect(submit).not.toBeDisabled();
  });

  it("calls onSubmit with the form values on save", async () => {
    const onSubmit = vi.fn();
    const { user } = await renderModal({ onSubmit });
    await user.type(
      screen.getByPlaceholderText(/what needs doing/i),
      "Buy bread",
    );
    await user.type(
      screen.getByPlaceholderText(/notes, links/i),
      "from the bakery",
    );
    await user.click(getSubmitButton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "from the bakery",
        title: "Buy bread",
      }),
    );
  });

  it("calls onDelete then closes when Delete is pressed in an existing todo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const { user } = await renderModal({
      initial: { title: "x" },
      onClose,
      onDelete,
    });
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes via the X button after the exit animation", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onClose = vi.fn();
    const { user } = await renderModal({ onClose });
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    await vi.advanceTimersByTimeAsync(250);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes via Escape key", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onClose = vi.fn();
    const { user } = await renderModal({ onClose });
    await user.keyboard("{Escape}");
    await vi.advanceTimersByTimeAsync(250);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Cancel button closes without invoking onSubmit", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    const { user } = await renderModal({ onClose, onSubmit });
    await user.type(
      screen.getByPlaceholderText(/what needs doing/i),
      "should not save",
    );
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await vi.advanceTimersByTimeAsync(250);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("clears the due date with the 'clear' button", async () => {
    const { user } = await renderModal({
      initial: { dueDate: "2030-01-01", title: "x" },
    });
    // Need to enter edit mode first.
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const dueInput = screen.getByLabelText(/due date/i) as HTMLInputElement;
    expect(dueInput.value).toBe("2030-01-01");
    await user.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(dueInput.value).toBe("");
  });

  it("calls /api/generate-description and writes the result into the description", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json(
        { description: "Generated text." },
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );
    // Geolocation might be undefined in happy-dom — explicitly stub.
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    const { user } = await renderModal();
    await user.type(
      screen.getByPlaceholderText(/what needs doing/i),
      "find coffee",
    );
    await user.click(
      screen.getByRole("button", { name: /generate description with ai/i }),
    );
    const textarea = screen.getByPlaceholderText(
      /notes, links/i,
    ) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toBe("Generated text."));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/generate-description",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
  });

  it("shows the AI error message when the server returns one", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json(
        { error: "Rate limit reached. Try again later." },
        { headers: { "Content-Type": "application/json" }, status: 429 },
      ),
    );
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    const { user } = await renderModal();
    await user.type(
      screen.getByPlaceholderText(/what needs doing/i),
      "find coffee",
    );
    await user.click(
      screen.getByRole("button", { name: /generate description with ai/i }),
    );
    expect(await screen.findByText(/rate limit reached/i)).toBeInTheDocument();
  });

  it("shows a generic AI error when the fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    const { user } = await renderModal();
    await user.type(screen.getByPlaceholderText(/what needs doing/i), "x");
    await user.click(
      screen.getByRole("button", { name: /generate description with ai/i }),
    );
    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
  });

  it("renders existing label as pressed and toggles it off on click", async () => {
    // Seed the registry so the label persists in the picker even after
    // being toggled off the todo.
    localStorage.setItem(
      "simple-todos:labels:v1",
      JSON.stringify([{ color: "blue", createdAt: 1, name: "work" }]),
    );
    const { user } = await renderModal({
      initial: { labels: ["work"], title: "x" },
    });
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const labelBtn = screen.getByRole("button", {
      name: "work",
      pressed: true,
    });
    await user.click(labelBtn);
    expect(
      screen.getByRole("button", { name: "work", pressed: false }),
    ).toBeInTheDocument();
  });

  it("plumbs the chosen Repeat preset through to onSubmit", async () => {
    const onSubmit = vi.fn();
    const { user } = await renderModal({ onSubmit });
    await user.type(
      screen.getByPlaceholderText(/what needs doing/i),
      "Water plants",
    );
    await user.click(screen.getByRole("button", { name: /^Daily$/i }));
    const submit = [...document.querySelectorAll("button")].find(
      (b) => b.type === "submit" && /^(Add|Save)$/i.test(b.textContent ?? ""),
    )! as HTMLButtonElement;
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrence: { every: 1, unit: "day" },
        title: "Water plants",
      }),
    );
  });

  it("hydrates the Repeat preset from an existing todo's recurrence", async () => {
    const { user } = await renderModal({
      initial: {
        recurrence: { every: 2, unit: "week" },
        title: "Trash day",
      },
    });
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    // Custom preset is pressed because every=2 isn't a named preset.
    expect(
      screen.getByRole("button", { name: /^Custom…$/, pressed: true }),
    ).toBeInTheDocument();
    // The numeric input shows 2 and the unit shows weeks.
    expect(screen.getByLabelText(/every \(number\)/i)).toHaveValue(2);
    expect(screen.getByLabelText(/every \(unit\)/i)).toHaveValue("week");
  });
});

// Seam test (ADR 0008): the focus-trap + escape hooks doing the work,
// plus the modal wiring them up. Unit tests cover the hooks in
// isolation; these prove TodoModal actually opts in.
describe("<TodoModal> a11y wiring", () => {
  function Harness({ initial }: { initial?: ReturnType<typeof makeTodo> }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button
          data-testid="trigger"
          onClick={() => setOpen(true)}
          type="button"
        >
          open
        </button>
        <TodoModal
          initial={initial}
          onClose={() => setOpen(false)}
          onSubmit={() => {}}
          open={open}
        />
      </>
    );
  }

  it("marks the dialog with aria-modal and labels it from the heading", async () => {
    await renderModal({ initial: { title: "x" } });
    const dialog = screen.getByRole("dialog", { name: /todo details/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.querySelector(`[id="${labelId}"]`)).toHaveTextContent(
      /todo details/i,
    );
  });

  it("traps Tab so focus wraps back into the dialog", async () => {
    // View mode (existing todo) has a small, stable set of focusables
    // and no title autofocus to race against.
    const { user } = await renderModal({ initial: { title: "x" } });
    const dialog = screen.getByRole("dialog");
    const focusables = getFocusable(dialog);
    expect(focusables.length).toBeGreaterThan(1);
    const last = focusables.at(-1)!;
    last.focus();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focusables[0]);
  });

  it("traps Shift+Tab so focus wraps to the last element", async () => {
    const { user } = await renderModal({ initial: { title: "x" } });
    const dialog = screen.getByRole("dialog");
    const focusables = getFocusable(dialog);
    const first = focusables[0];
    first.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(focusables.at(-1));
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    render(<Harness initial={makeTodo({ title: "x" })} />);
    const trigger = screen.getByTestId("trigger");
    await user.click(trigger);
    // Modal mounted and focus pulled inside the dialog.
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
