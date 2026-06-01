import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sentry is touched indirectly when safeWrite fires; mock it so the
// real SDK doesn't try to initialize.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { safeWrite } from "./storage";
import { useStorageError } from "./useStorageError";

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

function failQuota() {
    vi.spyOn(globalThis.localStorage, "setItem").mockImplementation(() => {
        const e = new Error("quota");
        e.name = "QuotaExceededError";
        throw e;
    });
}

describe("useStorageError", () => {
    it("starts null and updates when a write fails", () => {
        const { result } = renderHook(() => useStorageError());
        expect(result.current.error).toBeNull();
        act(() => {
            failQuota();
            safeWrite("simple-todos:x", "y");
        });
        expect(result.current.error).toBe("quota_exceeded");
    });

    it("dismiss clears the error back to null", () => {
        const { result } = renderHook(() => useStorageError());
        act(() => {
            failQuota();
            safeWrite("simple-todos:x", "y");
        });
        expect(result.current.error).toBe("quota_exceeded");
        act(() => {
            result.current.dismiss();
        });
        expect(result.current.error).toBeNull();
    });

    it("unsubscribes on unmount", () => {
        const { result, unmount } = renderHook(() => useStorageError());
        unmount();
        // Firing after unmount shouldn't crash or update anything visible
        // — there's nothing to assert on the result itself (it's stale)
        // but the act should not throw.
        expect(() => {
            failQuota();
            safeWrite("simple-todos:x", "y");
        }).not.toThrow();
        // Result is stale; just confirm it didn't somehow update.
        expect(result.current.error).toBeNull();
    });
});
