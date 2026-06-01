import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Sentry at the module boundary so we can assert capture
// without initializing the real SDK in tests. `vi.hoisted` keeps the
// spy visible to the hoisted `vi.mock` factory.
const { captureException } = vi.hoisted(() => ({
    captureException: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import Error from "./error";

// Generic boundary used to wire <Error> up to a child that throws.
// This proves the file is wired correctly as a React Error Boundary
// fallback, not just that the standalone component renders.
class TestErrorBoundary extends Component<
    { children: ReactNode },
    { error: globalThis.Error | null }
> {
    override state = { error: null as globalThis.Error | null };
    static getDerivedStateFromError(error: globalThis.Error) {
        return { error };
    }
    override render(): ReactNode {
        if (this.state.error) {
            return (
                <Error error={this.state.error} unstable_retry={() => null} />
            );
        }
        return this.props.children;
    }
}

function Boom(): null {
    throw new globalThis.Error("kaboom");
}

beforeEach(() => {
    // Silence the expected console.error log from the boundary itself.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    captureException.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("<Error> — page-level boundary", () => {
    it("renders the fallback message and a Try again button", () => {
        const error = new globalThis.Error("boom");
        render(<Error error={error} unstable_retry={vi.fn()} />);
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

    it("invokes unstable_retry when Try again is clicked", async () => {
        const retry = vi.fn();
        const user = userEvent.setup();
        render(
            <Error error={new globalThis.Error("x")} unstable_retry={retry} />,
        );
        await user.click(screen.getByRole("button", { name: /try again/i }));
        expect(retry).toHaveBeenCalledTimes(1);
    });

    it("shows the error digest when present and omits it otherwise", () => {
        const withDigest = Object.assign(new globalThis.Error("x"), {
            digest: "abc123",
        });
        const { rerender } = render(
            <Error error={withDigest} unstable_retry={vi.fn()} />,
        );
        expect(screen.getByText(/abc123/)).toBeInTheDocument();

        rerender(
            <Error
                error={new globalThis.Error("y")}
                unstable_retry={vi.fn()}
            />,
        );
        expect(screen.queryByText(/error reference/i)).toBeNull();
    });

    it("logs the error via console.error so DevTools surfaces it", () => {
        const consoleErr = vi.spyOn(console, "error");
        const error = new globalThis.Error("loud");
        render(<Error error={error} unstable_retry={vi.fn()} />);
        expect(consoleErr).toHaveBeenCalledWith(
            expect.stringContaining("Page-level error boundary"),
            error,
        );
    });

    it("catches a thrown render error from a child component", () => {
        // React logs to console.error during the boundary's recovery —
        // already mocked in beforeEach, so output stays clean.
        render(
            <TestErrorBoundary>
                <Boom />
            </TestErrorBoundary>,
        );
        expect(
            screen.getByRole("heading", { name: /something went wrong/i }),
        ).toBeVisible();
    });

    it("reports the error to Sentry tagged as boundary=page", () => {
        const error = new globalThis.Error("captured");
        render(<Error error={error} unstable_retry={vi.fn()} />);
        expect(captureException).toHaveBeenCalledWith(error, {
            tags: { boundary: "page" },
        });
    });

    it("calls location.reload when Reload page is clicked", async () => {
        const reload = vi
            .spyOn(globalThis.location, "reload")
            .mockImplementation(() => undefined);
        const user = userEvent.setup();
        render(
            <Error
                error={new globalThis.Error("x")}
                unstable_retry={vi.fn()}
            />,
        );
        await user.click(screen.getByRole("button", { name: /reload page/i }));
        expect(reload).toHaveBeenCalledTimes(1);
    });
});
