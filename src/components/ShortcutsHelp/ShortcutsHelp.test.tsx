import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ShortcutsHelp from "./index";

describe("ShortcutsHelp", () => {
    it("renders nothing when closed", () => {
        const { container } = render(
            <ShortcutsHelp onClose={vi.fn()} open={false} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("renders the dialog when open", () => {
        render(<ShortcutsHelp onClose={vi.fn()} open />);
        expect(
            screen.getByRole("dialog", { name: /keyboard shortcuts/i }),
        ).toBeInTheDocument();
    });

    it("lists all shortcut rows", () => {
        render(<ShortcutsHelp onClose={vi.fn()} open />);
        expect(screen.getByText("Focus search")).toBeInTheDocument();
        expect(screen.getByText("New todo")).toBeInTheDocument();
        expect(screen.getByText("Show shortcuts")).toBeInTheDocument();
        expect(screen.getByText("Close overlay")).toBeInTheDocument();
    });

    it("calls onClose when the close button is clicked", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<ShortcutsHelp onClose={onClose} open />);
        await user.click(screen.getByRole("button", { name: /close/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Escape is pressed", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<ShortcutsHelp onClose={onClose} open />);
        await user.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the backdrop is clicked", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<ShortcutsHelp onClose={onClose} open />);
        const backdrop = screen.getByRole("dialog");
        // mousedown on the dialog element itself (the backdrop)
        await user.pointer({ target: backdrop, keys: "[MouseLeft>]" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("traps focus inside the panel", async () => {
        const user = userEvent.setup();
        render(<ShortcutsHelp onClose={vi.fn()} open />);
        const closeBtn = screen.getByRole("button", { name: /close/i });
        // The only focusable element is the close button; Tab should keep
        // focus on it (wrap to the only focusable element).
        closeBtn.focus();
        await user.tab();
        expect(closeBtn).toHaveFocus();
    });

    it("restores focus to the trigger on close", () => {
        const trigger = document.createElement("button");
        document.body.appendChild(trigger);
        trigger.focus();
        expect(trigger).toHaveFocus();

        const { rerender } = render(<ShortcutsHelp onClose={vi.fn()} open />);
        // focus should now be inside the dialog
        expect(trigger).not.toHaveFocus();

        rerender(<ShortcutsHelp onClose={vi.fn()} open={false} />);
        expect(trigger).toHaveFocus();

        trigger.remove();
    });
});
