import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeTodo } from "@/test-utils/factories";

async function renderModal(props: {
  initial?: Parameters<typeof makeTodo>[0] | undefined;
  knownLabels?: string[];
  onSubmit?: (input: import("@/lib/todos").TodoInput) => void;
  onDelete?: () => void;
  onClose?: () => void;
} = {}) {
  vi.resetModules();
  const TodoModal = (await import("./TodoModal")).default;
  const initialTodo = props.initial ? makeTodo(props.initial) : undefined;
  const onSubmit = props.onSubmit ?? vi.fn();
  const onDelete = props.onDelete ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  const utils = render(
    <TodoModal
      open
      initial={initialTodo}
      knownLabels={props.knownLabels ?? []}
      onSubmit={onSubmit}
      onDelete={onDelete}
      onClose={onClose}
    />,
  );
  return {
    user: userEvent.setup(),
    onSubmit,
    onDelete,
    onClose,
    initial: initialTodo,
    ...utils,
  };
}

function getSubmitButton(): HTMLButtonElement {
  return Array.from(document.querySelectorAll("button"))
    .find((b) => b.type === "submit" && /^(Add|Save)$/i.test(b.textContent ?? "")) as HTMLButtonElement;
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
    const TodoModal = (await import("./TodoModal")).default;
    const { container } = render(
      <TodoModal
        open={false}
        knownLabels={[]}
        onSubmit={() => {}}
        onClose={() => {}}
      />,
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
      initial: { title: "existing todo", description: "details" },
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
        title: "Buy bread",
        description: "from the bakery",
      }),
    );
  });

  it("calls onDelete then closes when Delete is pressed in an existing todo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const { user } = await renderModal({
      initial: { title: "x" },
      onDelete,
      onClose,
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
      initial: { title: "x", dueDate: "2030-01-01" },
    });
    // Need to enter edit mode first.
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const dueInput = screen.getByLabelText(/due date/i) as HTMLInputElement;
    expect(dueInput.value).toBe("2030-01-01");
    await user.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(dueInput.value).toBe("");
  });

  it("calls /api/generate-description and writes the result into the description", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ description: "Generated text." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
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
    const textarea = screen.getByPlaceholderText(/notes, links/i) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toBe("Generated text."));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/generate-description",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("shows the AI error message when the server returns one", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Rate limit reached. Try again later." }),
        { status: 429, headers: { "Content-Type": "application/json" } },
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
    expect(
      await screen.findByText(/rate limit reached/i),
    ).toBeInTheDocument();
  });

  it("shows a generic AI error when the fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    const { user } = await renderModal();
    await user.type(
      screen.getByPlaceholderText(/what needs doing/i),
      "x",
    );
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
      JSON.stringify([{ name: "work", color: "blue", createdAt: 1 }]),
    );
    const { user } = await renderModal({
      initial: { title: "x", labels: ["work"] },
      knownLabels: ["work"],
    });
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const labelBtn = screen.getByRole("button", { name: "work", pressed: true });
    await user.click(labelBtn);
    expect(
      screen.getByRole("button", { name: "work", pressed: false }),
    ).toBeInTheDocument();
  });
});

