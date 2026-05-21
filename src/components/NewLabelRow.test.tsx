import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NewLabelRow } from "./NewLabelRow";

function setup(opts: {
  existing?: Set<string>;
  onAdd?: (name: string, color: string) => void;
  onNameChange?: (name: string) => void;
}) {
  const onAdd = opts.onAdd ?? vi.fn();
  const onNameChange = opts.onNameChange ?? vi.fn();
  render(
    <NewLabelRow
      existingNames={opts.existing ?? new Set()}
      onAdd={onAdd}
      onNameChange={onNameChange}
    />,
  );
  return {
    addButton: screen.getByRole("button", { name: /^add$/i }),
    input: screen.getByPlaceholderText(/new label name/i) as HTMLInputElement,
    onAdd,
    onNameChange,
    user: userEvent.setup(),
  };
}

describe("<NewLabelRow>", () => {
  it("Add button is disabled when input is empty", () => {
    const { addButton } = setup({});
    expect(addButton).toBeDisabled();
  });

  it("calls onAdd with the trimmed name and default color when Add is clicked", async () => {
    const onAdd = vi.fn();
    const { addButton, input, user } = setup({ onAdd });
    await user.type(input, "  Work  ");
    await user.click(addButton);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith("Work", "gray");
  });

  it("collapses internal whitespace runs", async () => {
    const onAdd = vi.fn();
    const { addButton, input, user } = setup({ onAdd });
    await user.type(input, "side   project");
    await user.click(addButton);
    expect(onAdd).toHaveBeenCalledWith("side project", "gray");
  });

  it("submits on Enter", async () => {
    const onAdd = vi.fn();
    const { input, user } = setup({ onAdd });
    await user.type(input, "x{Enter}");
    expect(onAdd).toHaveBeenCalledWith("x", "gray");
  });

  it("does not call onAdd for duplicate (case-insensitive)", async () => {
    const onAdd = vi.fn();
    const { addButton, input, user } = setup({
      existing: new Set(["work"]),
      onAdd,
    });
    await user.type(input, "WORK");
    await user.click(addButton);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("does not call onAdd for whitespace-only input", async () => {
    const onAdd = vi.fn();
    const { input, user } = setup({ onAdd });
    // Cannot click disabled button — try Enter instead.
    await user.type(input, "   {Enter}");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("clears name + resets onNameChange after a successful add", async () => {
    const onNameChange = vi.fn();
    const { addButton, input, user } = setup({ onNameChange });
    await user.type(input, "foo");
    await user.click(addButton);
    expect(input.value).toBe("");
    // onNameChange called for each keystroke, plus once with "" after add.
    expect(onNameChange).toHaveBeenLastCalledWith("");
  });

  it("opens the inline color picker and submits with a chosen color", async () => {
    const onAdd = vi.fn();
    const { addButton, input, user } = setup({ onAdd });
    await user.click(screen.getByRole("button", { name: /label color$/i }));
    // The dialog appears in a portal — find it by its dialog role.
    const dialog = await screen.findByRole("dialog", {
      name: /label color options/i,
    });
    // Pick "blue" — the swatch buttons are named like "Label color: blue".
    await user.click(
      within(dialog).getByRole("button", { name: /label color: blue/i }),
    );
    // Picker closes after a named-color selection; submit the form.
    await user.type(input, "client");
    await user.click(addButton);
    expect(onAdd).toHaveBeenCalledWith("client", "blue");
  });
});
