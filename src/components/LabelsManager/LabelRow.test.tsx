import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Label } from "@/lib/labels";

import { LabelRow } from "./LabelRow";

function makeLabel(overrides: Partial<Label> = {}): Label {
    return {
        color: "blue",
        createdAt: 0,
        name: "work",
        ...overrides,
    };
}

function renderRow(
    opts: {
        count?: number;
        label?: Label;
        onDelete?: () => void;
        onRecolor?: (c: Label["color"]) => void;
        onRename?: (next: string) => void;
    } = {},
) {
    const onDelete = opts.onDelete ?? vi.fn();
    const onRecolor = opts.onRecolor ?? vi.fn();
    const onRename = opts.onRename ?? vi.fn();
    const utils = render(
        <LabelRow
            count={opts.count ?? 0}
            label={opts.label ?? makeLabel()}
            onDelete={onDelete}
            onRecolor={onRecolor}
            onRename={onRename}
        />,
    );
    // The draggable inner div is the only descendant with a translateX
    // transform; grab it through the row's data-label-name root.
    const root =
        utils.container.querySelector<HTMLElement>("[data-label-name]");
    expect(root).not.toBeNull();
    const draggable = root!.querySelector<HTMLElement>(
        'div[style*="translateX"]',
    );
    expect(draggable).not.toBeNull();
    return {
        draggable: draggable!,
        onDelete,
        onRecolor,
        onRename,
        root: root!,
        ...utils,
    };
}

function transformX(el: HTMLElement): number {
    // LabelRow only writes integer pixel offsets, so we don't need to
    // match a fractional part. Keeping the regex linear (no nested
    // quantifiers) silences CodeQL's ReDoS heuristic.
    const match = /translateX\((-?\d+)px\)/.exec(el.style.transform);
    return match ? Number(match[1]) : 0;
}

afterEach(() => {
    vi.useRealTimers();
});

describe("<LabelRow> swipe gestures", () => {
    it("rejects vertical drags (lets the scroll container own them)", () => {
        const { draggable } = renderRow();
        fireEvent.pointerDown(draggable, {
            button: 0,
            clientX: 100,
            clientY: 100,
            pointerId: 1,
            pointerType: "touch",
        });
        // Movement is mostly vertical → component aborts the drag without
        // capturing.
        fireEvent.pointerMove(draggable, {
            clientX: 102,
            clientY: 60,
            pointerId: 1,
        });
        fireEvent.pointerMove(draggable, {
            clientX: 102,
            clientY: 20,
            pointerId: 1,
        });
        fireEvent.pointerUp(draggable, {
            clientX: 102,
            clientY: 20,
            pointerId: 1,
        });
        expect(transformX(draggable)).toBe(0);
    });

    it("ignores movement under the 6px capture threshold", () => {
        const { draggable } = renderRow();
        fireEvent.pointerDown(draggable, {
            button: 0,
            clientX: 100,
            clientY: 100,
            pointerId: 1,
            pointerType: "touch",
        });
        fireEvent.pointerMove(draggable, {
            clientX: 97,
            clientY: 100,
            pointerId: 1,
        });
        fireEvent.pointerUp(draggable, {
            clientX: 97,
            clientY: 100,
            pointerId: 1,
        });
        expect(transformX(draggable)).toBe(0);
    });

    it("snaps to the peek offset when drag passes -40 but stays above the delete threshold", () => {
        const { draggable, root } = renderRow();
        fireEvent.pointerDown(draggable, {
            button: 0,
            clientX: 200,
            clientY: 50,
            pointerId: 1,
            pointerType: "touch",
        });
        // Drag left past the 6px capture threshold, then beyond -40.
        fireEvent.pointerMove(draggable, {
            clientX: 140,
            clientY: 50,
            pointerId: 1,
        });
        fireEvent.pointerUp(draggable, {
            clientX: 140,
            clientY: 50,
            pointerId: 1,
        });
        // Component snaps to PEEK_OFFSET (-88) on release.
        expect(transformX(draggable)).toBe(-88);
        // Trash button's aria-expanded flips to true, and the Delete
        // confirm button becomes interactive (pointer-events: auto).
        expect(
            screen.getByRole("button", { name: /^delete work$/i }),
        ).toHaveAttribute("aria-expanded", "true");
        const confirm = screen.getByRole("button", {
            name: /confirm delete work/i,
        });
        expect(confirm).toHaveStyle({ pointerEvents: "auto" });
        // tabIndex is 0 in peek so it's keyboard-reachable.
        expect(confirm).toHaveAttribute("tabIndex", "0");
        // Sanity: container is the row, not stale.
        expect(root).toHaveAttribute("data-label-name", "work");
    });

    it("triggers onDelete (after exit animation) when drag passes the delete threshold", () => {
        vi.useFakeTimers();
        const onDelete = vi.fn();
        const { draggable } = renderRow({ onDelete });
        fireEvent.pointerDown(draggable, {
            button: 0,
            clientX: 200,
            clientY: 50,
            pointerId: 1,
            pointerType: "touch",
        });
        // Drag far enough left to clear DELETE_THRESHOLD (-160).
        fireEvent.pointerMove(draggable, {
            clientX: 30,
            clientY: 50,
            pointerId: 1,
        });
        fireEvent.pointerUp(draggable, {
            clientX: 30,
            clientY: 50,
            pointerId: 1,
        });
        // onDelete fires after the 260ms exit animation.
        expect(onDelete).not.toHaveBeenCalled();
        vi.advanceTimersByTime(260);
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("ignores right-click / middle-click on mouse pointers", () => {
        const { draggable } = renderRow();
        fireEvent.pointerDown(draggable, {
            button: 2,
            clientX: 100,
            clientY: 50,
            pointerId: 1,
            pointerType: "mouse",
        });
        fireEvent.pointerMove(draggable, {
            clientX: 30,
            clientY: 50,
            pointerId: 1,
        });
        fireEvent.pointerUp(draggable, {
            clientX: 30,
            clientY: 50,
            pointerId: 1,
        });
        expect(transformX(draggable)).toBe(0);
    });

    it("does not start a drag while in edit mode", () => {
        const { draggable } = renderRow();
        // Enter edit mode via the pencil button.
        fireEvent.click(screen.getByRole("button", { name: /edit work/i }));
        fireEvent.pointerDown(draggable, {
            button: 0,
            clientX: 200,
            clientY: 50,
            pointerId: 1,
            pointerType: "touch",
        });
        fireEvent.pointerMove(draggable, {
            clientX: 30,
            clientY: 50,
            pointerId: 1,
        });
        fireEvent.pointerUp(draggable, {
            clientX: 30,
            clientY: 50,
            pointerId: 1,
        });
        expect(transformX(draggable)).toBe(0);
    });

    it("clicking the trash icon toggles peek state without a drag", () => {
        const { draggable } = renderRow();
        const trash = screen.getByRole("button", { name: /^delete work$/i });
        fireEvent.click(trash);
        expect(transformX(draggable)).toBe(-88);
        fireEvent.click(trash);
        expect(transformX(draggable)).toBe(0);
    });

    it("collapses peek state when clicking outside the row", () => {
        const { draggable } = renderRow();
        fireEvent.click(screen.getByRole("button", { name: /^delete work$/i }));
        expect(transformX(draggable)).toBe(-88);
        // Click on document body (outside the row's containing div).
        fireEvent.mouseDown(document.body);
        expect(transformX(draggable)).toBe(0);
    });
});
