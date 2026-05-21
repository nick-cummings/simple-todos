import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LabelColor } from "@/lib/labels";

import { InlineColorPicker, NewLabelRow } from "./NewLabelRow";

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

/* ---------- InlineColorPicker / CustomSwatch / HSV picker ---------- */

function renderPicker(opts: { initial?: LabelColor } = {}) {
  const onChange = vi.fn<(c: LabelColor) => void>();
  const utils = render(
    <InlineColorPicker
      ariaLabel="Pick color"
      onChange={onChange}
      value={opts.initial ?? "gray"}
    />,
  );
  return { onChange, user: userEvent.setup(), ...utils };
}

describe("<InlineColorPicker>", () => {
  it("opens and closes when the trigger is clicked twice", async () => {
    const { user } = renderPicker();
    const trigger = screen.getByRole("button", { name: /pick color$/i });
    await user.click(trigger);
    expect(
      await screen.findByRole("dialog", { name: /pick color options/i }),
    ).toBeVisible();
    await user.click(trigger);
    expect(
      screen.queryByRole("dialog", { name: /pick color options/i }),
    ).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const { user } = renderPicker();
    await user.click(screen.getByRole("button", { name: /pick color$/i }));
    await screen.findByRole("dialog", { name: /pick color options/i });
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: /pick color options/i }),
    ).not.toBeInTheDocument();
  });

  it("closes when clicking outside the picker", async () => {
    const { user } = renderPicker();
    await user.click(screen.getByRole("button", { name: /pick color$/i }));
    await screen.findByRole("dialog", { name: /pick color options/i });
    await user.click(document.body);
    expect(
      screen.queryByRole("dialog", { name: /pick color options/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onChange with each named color and closes after selection", async () => {
    const onChange = vi.fn<(c: LabelColor) => void>();
    const { user } = renderPicker();
    const trigger = screen.getByRole("button", { name: /pick color$/i });

    for (const named of ["red", "green", "purple"] as const) {
      await user.click(trigger);
      const dialog = await screen.findByRole("dialog", {
        name: /pick color options/i,
      });
      await user.click(
        within(dialog).getByRole("button", {
          name: new RegExp(`pick color: ${named}`, "i"),
        }),
      );
      // Picker closes after a named-color selection.
      expect(
        screen.queryByRole("dialog", { name: /pick color options/i }),
      ).not.toBeInTheDocument();
    }

    // Re-render with a spy to assert direct callback wiring.
    render(
      <InlineColorPicker
        ariaLabel="Pick color spy"
        onChange={onChange}
        value="gray"
      />,
    );
    await user.click(screen.getByRole("button", { name: /pick color spy$/i }));
    const spyDialog = await screen.findByRole("dialog", {
      name: /pick color spy options/i,
    });
    await user.click(
      within(spyDialog).getByRole("button", { name: /pick color spy: amber/i }),
    );
    expect(onChange).toHaveBeenCalledWith("amber");
  });

  it("opens the HSV picker when the rainbow (custom) swatch is clicked", async () => {
    const { user } = renderPicker();
    await user.click(screen.getByRole("button", { name: /pick color$/i }));
    const dialog = await screen.findByRole("dialog", {
      name: /pick color options/i,
    });
    await user.click(
      within(dialog).getByRole("button", { name: /pick color: custom/i }),
    );
    expect(
      await screen.findByRole("dialog", { name: /pick color: custom picker/i }),
    ).toBeVisible();
    // Inline picker stays open (data-picker-portal lets nested portal
    // bubble back to it without closing).
    expect(
      screen.getByRole("dialog", { name: /pick color options/i }),
    ).toBeVisible();
  });

  it("calls onChange with a hex code when the saturation/brightness pad is clicked", async () => {
    const { onChange, user } = renderPicker({ initial: "#FF4D4D" });
    await user.click(screen.getByRole("button", { name: /pick color$/i }));
    const dialog = await screen.findByRole("dialog", {
      name: /pick color options/i,
    });
    await user.click(
      within(dialog).getByRole("button", { name: /pick color: custom/i }),
    );
    const pad = await screen.findByRole("application", {
      name: /saturation and brightness/i,
    });
    // happy-dom's getBoundingClientRect returns zeros by default; stub
    // a 100x100 box so the math in setFromPad yields a deterministic hex.
    pad.getBoundingClientRect = () =>
      ({
        bottom: 100,
        height: 100,
        left: 0,
        right: 100,
        top: 0,
        width: 100,
      }) as DOMRect;
    fireEvent.pointerDown(pad, {
      clientX: 50,
      clientY: 50,
      pointerId: 1,
    });
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls[0][0] as string;
    expect(arg).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("calls onChange when the hue slider is clicked", async () => {
    const { onChange, user } = renderPicker({ initial: "#FF4D4D" });
    await user.click(screen.getByRole("button", { name: /pick color$/i }));
    await user.click(
      within(
        await screen.findByRole("dialog", { name: /pick color options/i }),
      ).getByRole("button", { name: /pick color: custom/i }),
    );
    const hue = await screen.findByRole("slider", { name: /hue/i });
    hue.getBoundingClientRect = () =>
      ({
        bottom: 12,
        height: 12,
        left: 0,
        right: 360,
        top: 0,
        width: 360,
      }) as DOMRect;
    fireEvent.pointerDown(hue, { clientX: 180, pointerId: 1 });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("pad pointerMove only fires onChange while the pointer is captured", async () => {
    const { onChange, user } = renderPicker({ initial: "#FF4D4D" });
    await user.click(screen.getByRole("button", { name: /pick color$/i }));
    await user.click(
      within(
        await screen.findByRole("dialog", { name: /pick color options/i }),
      ).getByRole("button", { name: /pick color: custom/i }),
    );
    const pad = await screen.findByRole("application", {
      name: /saturation and brightness/i,
    });
    pad.getBoundingClientRect = () =>
      ({
        bottom: 100,
        height: 100,
        left: 0,
        right: 100,
        top: 0,
        width: 100,
      }) as DOMRect;

    // Move without prior pointerDown — hasPointerCapture is false, no call.
    fireEvent.pointerMove(pad, { clientX: 10, clientY: 10, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();

    // Down then move — capture is active, both fire onChange.
    fireEvent.pointerDown(pad, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientX: 80, clientY: 80, pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
