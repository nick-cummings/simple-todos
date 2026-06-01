import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEscapeKey } from "@/lib/useEscapeKey";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { makeTodo } from "@/test-utils/factories";

import TodoModal from "./TodoModal";

// Seam test (ADR 0008), call-pattern flavour. The behavioural counterpart
// — focus actually traps, Escape actually closes — lives in
// TodoModal.test.tsx. Mocking the hooks here proves TodoModal wires them
// with the RIGHT arguments (panel ref, close callback), catching arg-level
// bugs (wrong ref / stale callback) that behaviour alone can't distinguish.
vi.mock("@/lib/useFocusTrap", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/useFocusTrap")>()),
    useFocusTrap: vi.fn(),
}));
vi.mock("@/lib/useEscapeKey", () => ({ useEscapeKey: vi.fn() }));

function renderOpen(onClose: () => void = () => {}) {
    return render(
        <TodoModal
            initial={makeTodo({ title: "x" })}
            onClose={onClose}
            onSubmit={() => {}}
            open
        />,
    );
}

describe("<TodoModal> hook wiring (ADR 0008 seam)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("hands useFocusTrap the dialog panel ref", () => {
        renderOpen();
        expect(useFocusTrap).toHaveBeenCalledTimes(1);
        const ref = vi.mocked(useFocusTrap).mock.calls[0][0];
        expect(ref.current).toBeInstanceOf(HTMLElement);
        // The ref resolves to the panel rendered inside the dialog container.
        expect(screen.getByRole("dialog")).toContainElement(ref.current!);
    });

    it("hands useEscapeKey the modal's close handler", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const onClose = vi.fn();
        renderOpen(onClose);
        expect(useEscapeKey).toHaveBeenCalledTimes(1);
        const onEscape = vi.mocked(useEscapeKey).mock.calls[0][0];
        expect(onEscape).toBeInstanceOf(Function);
        // Invoking the wired callback must drive the close path — proves it's
        // the close handler, not just *a* function (a wrong/stale callback
        // would pass `expect.any(Function)` but fail to close).
        await act(async () => {
            onEscape();
            await vi.advanceTimersByTimeAsync(300);
        });
        expect(onClose).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it("wires neither hook while closed", () => {
        render(
            <TodoModal onClose={() => {}} onSubmit={() => {}} open={false} />,
        );
        expect(useFocusTrap).not.toHaveBeenCalled();
        expect(useEscapeKey).not.toHaveBeenCalled();
    });
});
