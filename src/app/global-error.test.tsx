import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { captureException } = vi.hoisted(() => ({
    captureException: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import { GlobalErrorBody } from "./global-error";

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    captureException.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("<GlobalError> — root-layout boundary", () => {
    it("renders fallback content with Try again + Reload", () => {
        render(
            <GlobalErrorBody
                error={new globalThis.Error("boom")}
                unstable_retry={vi.fn()}
            />,
        );
        expect(
            screen.getByRole("heading", { name: /something went wrong/i }),
        ).toBeVisible();
        expect(
            screen.getByRole("button", { name: /try again/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /reload page/i }),
        ).toBeInTheDocument();
    });

    it("calls unstable_retry when Try again is clicked", async () => {
        const retry = vi.fn();
        const user = userEvent.setup();
        render(
            <GlobalErrorBody
                error={new globalThis.Error("x")}
                unstable_retry={retry}
            />,
        );
        await user.click(screen.getByRole("button", { name: /try again/i }));
        expect(retry).toHaveBeenCalledTimes(1);
    });

    it("shows the digest when present and hides the reference line otherwise", () => {
        const withDigest = Object.assign(new globalThis.Error("x"), {
            digest: "deadbeef",
        });
        const { rerender } = render(
            <GlobalErrorBody error={withDigest} unstable_retry={vi.fn()} />,
        );
        expect(screen.getByText(/deadbeef/)).toBeInTheDocument();
        rerender(
            <GlobalErrorBody
                error={new globalThis.Error("y")}
                unstable_retry={vi.fn()}
            />,
        );
        expect(screen.queryByText(/error reference/i)).toBeNull();
    });

    it("logs caught errors via console.error", () => {
        const consoleErr = vi.spyOn(console, "error");
        const error = new globalThis.Error("loud");
        render(<GlobalErrorBody error={error} unstable_retry={vi.fn()} />);
        expect(consoleErr).toHaveBeenCalledWith(
            expect.stringContaining("Global error boundary"),
            error,
        );
    });

    it("reports the error to Sentry tagged as boundary=global", () => {
        const error = new globalThis.Error("captured");
        render(<GlobalErrorBody error={error} unstable_retry={vi.fn()} />);
        expect(captureException).toHaveBeenCalledWith(error, {
            tags: { boundary: "global" },
        });
    });
});
