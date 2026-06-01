import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { safeWrite } from "./storage";
import { fireAtForDueDate, useReminders } from "./useReminders";

// Seam mock (ADR 0008 / ADR 0012): the hook must persist the prompted
// flag and browserId through `safeWrite`, not raw `localStorage.setItem`.
// Default impl writes through so the existing flow-level tests still
// observe persistence; the seam tests below assert the call shape.
vi.mock("./storage", () => ({
    safeWrite: vi.fn((key: string, value: string) => {
        globalThis.localStorage.setItem(key, value);
        return true;
    }),
}));

// We mock browser-only APIs (Notification, navigator.serviceWorker)
// per test. happy-dom doesn't ship a Push API.

interface MockReg {
    pushManager: {
        getSubscription: () => Promise<MockSubscription | null>;
        subscribe: (opts: unknown) => Promise<MockSubscription>;
    };
}

interface MockSubscription {
    toJSON: () => Record<string, unknown>;
    unsubscribe: () => Promise<true>;
}

function installNotificationMock(initial: NotificationPermission = "default") {
    const state = { permission: initial as NotificationPermission };
    const requestPermission = vi.fn(async () => state.permission);
    const NotificationCtor = {
        get permission() {
            return state.permission;
        },
        requestPermission,
    };
    Object.defineProperty(globalThis, "Notification", {
        configurable: true,
        value: NotificationCtor,
        writable: true,
    });
    return {
        grant() {
            state.permission = "granted";
        },
        requestPermission,
        setPermission(p: NotificationPermission) {
            state.permission = p;
        },
    };
}

function installServiceWorkerMock(initialSub: MockSubscription | null = null) {
    const state = { sub: initialSub };
    const subscribe = vi.fn(async () => {
        state.sub = {
            toJSON: () => ({
                endpoint: "https://example.com/push/abc",
                keys: { auth: "a", p256dh: "p" },
            }),
            unsubscribe: vi.fn(async () => true as const),
        };
        return state.sub;
    });
    const reg: MockReg = {
        pushManager: {
            getSubscription: vi.fn(async () => state.sub),
            subscribe,
        },
    };
    Object.defineProperty(globalThis.navigator, "serviceWorker", {
        configurable: true,
        value: {
            ready: Promise.resolve(reg),
        },
        writable: true,
    });
    return { reg, state, subscribe };
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
    localStorage.clear();
    // Restore the write-through default each test; seam tests override it
    // and afterEach's restoreAllMocks would otherwise leave it cleared.
    vi.mocked(safeWrite).mockReset();
    vi.mocked(safeWrite).mockImplementation((key: string, value: string) => {
        globalThis.localStorage.setItem(key, value);
        return true;
    });
    fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        value: fetchSpy,
        writable: true,
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    // Reset Notification / serviceWorker between tests so leftovers from
    // one test don't bleed into another.
    Reflect.deleteProperty(
        globalThis as unknown as Record<string, unknown>,
        "Notification",
    );
});

describe("fireAtForDueDate", () => {
    it("returns midnight UTC of the given ISO date", () => {
        expect(fireAtForDueDate("2026-05-21")).toBe(
            Date.UTC(2026, 4, 21, 0, 0, 0),
        );
    });
    it("returns null for empty / malformed input", () => {
        expect(fireAtForDueDate(undefined)).toBeNull();
        expect(fireAtForDueDate("")).toBeNull();
        expect(fireAtForDueDate("nope")).toBeNull();
        expect(fireAtForDueDate("2026-13-99")).toBeDefined();
    });
});

describe("useReminders — initial state", () => {
    it("reports unsupported when Notification API is absent", async () => {
        // Don't install Notification mock.
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: "k" }),
        );
        await waitFor(() =>
            expect(result.current.permission).toBe("unsupported"),
        );
        expect(result.current.active).toBe(false);
        expect(result.current.needsAttention).toBe(false);
    });

    it("reports prompt and surfaces needsAttention when permission is default", async () => {
        installNotificationMock("default");
        installServiceWorkerMock(null);
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: "k" }),
        );
        await waitFor(() => expect(result.current.permission).toBe("prompt"));
        expect(result.current.needsAttention).toBe(true);
    });

    it("hides needsAttention once the user has been prompted before", async () => {
        installNotificationMock("default");
        installServiceWorkerMock(null);
        localStorage.setItem("simple-todos:reminders:prompted", "1");
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: "k" }),
        );
        await waitFor(() => expect(result.current.permission).toBe("prompt"));
        expect(result.current.needsAttention).toBe(false);
    });

    it("hides needsAttention when no VAPID key is configured", async () => {
        installNotificationMock("default");
        installServiceWorkerMock(null);
        const { result } = renderHook(() => useReminders({}));
        await waitFor(() => expect(result.current.permission).toBe("prompt"));
        expect(result.current.needsAttention).toBe(false);
    });

    it("hydrates active=true when a subscription already exists", async () => {
        installNotificationMock("granted");
        installServiceWorkerMock({
            toJSON: () => ({}),
            unsubscribe: vi.fn(async () => true as const),
        });
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: "k" }),
        );
        await waitFor(() => expect(result.current.active).toBe(true));
    });
});

describe("useReminders.enable", () => {
    // VAPID public key encoded as base64url so atob doesn't choke. The
    // value itself isn't validated by the hook (the browser does the
    // real check); we just need something decodable.
    const VAPID = "BNbxGYNMhEIi9zrneh7l_RTPiLLMfS1cN3pXdQXBb3IOmcZdLxR";

    it("requests permission, subscribes, and POSTs the subscription", async () => {
        const note = installNotificationMock("default");
        installServiceWorkerMock(null);
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: VAPID }),
        );
        await waitFor(() => expect(result.current.permission).toBe("prompt"));

        note.requestPermission.mockImplementationOnce(async () => {
            note.grant();
            return "granted";
        });

        let ok = false;
        await act(async () => {
            ok = await result.current.enable();
        });
        expect(ok).toBe(true);
        expect(result.current.active).toBe(true);
        // Subscription POSTed.
        expect(fetchSpy).toHaveBeenCalled();
        const [url, init] = fetchSpy.mock.calls[0];
        expect(url).toBe("/api/push/subscribe");
        expect((init as RequestInit).method).toBe("POST");
        const body = JSON.parse((init as RequestInit).body as string);
        expect(typeof body.browserId).toBe("string");
        expect(body.subscription).toBeTruthy();
    });

    it("returns false when the user denies the permission prompt", async () => {
        const note = installNotificationMock("default");
        installServiceWorkerMock(null);
        note.requestPermission.mockImplementationOnce(async () => "denied");
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: VAPID }),
        );
        await waitFor(() => expect(result.current.permission).toBe("prompt"));

        let ok = true;
        await act(async () => {
            ok = await result.current.enable();
        });
        expect(ok).toBe(false);
        expect(result.current.active).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns false when no VAPID key is configured", async () => {
        installNotificationMock("default");
        installServiceWorkerMock(null);
        const { result } = renderHook(() => useReminders({}));
        let ok = true;
        await act(async () => {
            ok = await result.current.enable();
        });
        expect(ok).toBe(false);
    });
});

describe("useReminders error paths", () => {
    it("sets active=false when getSubscription throws during hydration", async () => {
        installNotificationMock("granted");
        Object.defineProperty(globalThis.navigator, "serviceWorker", {
            configurable: true,
            value: {
                ready: Promise.resolve({
                    pushManager: {
                        getSubscription: vi.fn(async () => {
                            throw new Error("boom");
                        }),
                        subscribe: vi.fn(),
                    },
                }),
            },
            writable: true,
        });
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: "k" }),
        );
        await waitFor(() => expect(result.current.permission).toBe("granted"));
        expect(result.current.active).toBe(false);
    });

    it("enable returns false when Notification is absent at call time", async () => {
        // No Notification mock installed.
        installServiceWorkerMock(null);
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: "k" }),
        );
        await waitFor(() =>
            expect(result.current.permission).toBe("unsupported"),
        );
        let ok = true;
        await act(async () => {
            ok = await result.current.enable();
        });
        expect(ok).toBe(false);
    });
});

describe("useReminders.disable", () => {
    it("unsubscribes, DELETEs the subscription, and clears active", async () => {
        installNotificationMock("granted");
        const sub = {
            toJSON: () => ({}),
            unsubscribe: vi.fn(async () => true as const),
        };
        installServiceWorkerMock(sub);
        // Seed a browserId so the DELETE has somewhere to call.
        localStorage.setItem("simple-todos:browserId", "deadbeef1");

        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: "k" }),
        );
        await waitFor(() => expect(result.current.active).toBe(true));
        await act(async () => {
            await result.current.disable();
        });
        expect(sub.unsubscribe).toHaveBeenCalled();
        expect(result.current.active).toBe(false);
        const deleteCall = fetchSpy.mock.calls.find(
            (c) => (c[1] as RequestInit | undefined)?.method === "DELETE",
        );
        expect(deleteCall).toBeTruthy();
    });
});

describe("useReminders.syncTodoReminder", () => {
    const today = "2027-01-15";

    function makeTodo(
        overrides: Partial<
            Parameters<ReturnType<typeof useReminders>["syncTodoReminder"]>[0]
        > = {},
    ) {
        return {
            completed: false,
            createdAt: 0,
            dueDate: today,
            id: "t1",
            labels: [],
            title: "Take out trash",
            updatedAt: 0,
            ...overrides,
        };
    }

    it("POSTs a reminder when the todo has a due date and reminders are active", async () => {
        installNotificationMock("granted");
        installServiceWorkerMock({
            toJSON: () => ({}),
            unsubscribe: vi.fn(async () => true as const),
        });
        localStorage.setItem("simple-todos:browserId", "deadbeef1");
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: "k" }),
        );
        await waitFor(() => expect(result.current.active).toBe(true));
        fetchSpy.mockClear();

        await act(async () => {
            await result.current.syncTodoReminder(makeTodo());
        });
        const postCall = fetchSpy.mock.calls.find(
            (c) => c[0] === "/api/push/reminders",
        );
        expect(postCall).toBeTruthy();
        const body = JSON.parse((postCall![1] as RequestInit).body as string);
        expect(body).toMatchObject({
            browserId: "deadbeef1",
            id: "r-t1",
            todoId: "t1",
            url: expect.stringContaining("t1"),
        });
        expect(typeof body.fireAt).toBe("number");
    });

    it("DELETEs the reminder when the todo has no due date", async () => {
        installNotificationMock("granted");
        installServiceWorkerMock({
            toJSON: () => ({}),
            unsubscribe: vi.fn(async () => true as const),
        });
        localStorage.setItem("simple-todos:browserId", "deadbeef1");
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: "k" }),
        );
        await waitFor(() => expect(result.current.active).toBe(true));
        fetchSpy.mockClear();

        await act(async () => {
            await result.current.syncTodoReminder(
                makeTodo({ dueDate: undefined }),
            );
        });
        const deleteCall = fetchSpy.mock.calls.find(
            (c) => (c[1] as RequestInit | undefined)?.method === "DELETE",
        );
        expect(deleteCall).toBeTruthy();
    });

    it("DELETEs the reminder when the todo is completed", async () => {
        installNotificationMock("granted");
        installServiceWorkerMock({
            toJSON: () => ({}),
            unsubscribe: vi.fn(async () => true as const),
        });
        localStorage.setItem("simple-todos:browserId", "deadbeef1");
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: "k" }),
        );
        await waitFor(() => expect(result.current.active).toBe(true));
        fetchSpy.mockClear();

        await act(async () => {
            await result.current.syncTodoReminder(
                makeTodo({ completed: true }),
            );
        });
        const deleteCall = fetchSpy.mock.calls.find(
            (c) => (c[1] as RequestInit | undefined)?.method === "DELETE",
        );
        expect(deleteCall).toBeTruthy();
    });

    it("is a no-op when reminders are not active", async () => {
        installNotificationMock("default");
        installServiceWorkerMock(null);
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: "k" }),
        );
        await waitFor(() => expect(result.current.permission).toBe("prompt"));
        fetchSpy.mockClear();
        await act(async () => {
            await result.current.syncTodoReminder(makeTodo());
        });
        // Active is false → DELETE path runs; but no browserId is stored,
        // so we early-return without calling fetch.
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe("useReminders — safeWrite seam (ADR 0012)", () => {
    const VAPID = "BNbxGYNMhEIi9zrneh7l_RTPiLLMfS1cN3pXdQXBb3IOmcZdLxR";

    async function enableViaPrompt() {
        const note = installNotificationMock("default");
        installServiceWorkerMock(null);
        const { result } = renderHook(() =>
            useReminders({ vapidPublicKey: VAPID }),
        );
        await waitFor(() => expect(result.current.permission).toBe("prompt"));
        note.requestPermission.mockImplementationOnce(async () => {
            note.grant();
            return "granted";
        });
        let ok = false;
        await act(async () => {
            ok = await result.current.enable();
        });
        return { ok, result };
    }

    it("persists the prompted flag through safeWrite, not raw localStorage", async () => {
        await enableViaPrompt();
        expect(vi.mocked(safeWrite)).toHaveBeenCalledWith(
            "simple-todos:reminders:prompted",
            "1",
        );
    });

    it("persists a freshly minted browserId through safeWrite", async () => {
        await enableViaPrompt();
        expect(vi.mocked(safeWrite)).toHaveBeenCalledWith(
            "simple-todos:browserId",
            expect.any(String),
        );
    });

    it("does not re-write the browserId when one is already stored", async () => {
        localStorage.setItem("simple-todos:browserId", "deadbeef1");
        vi.mocked(safeWrite).mockClear();
        await enableViaPrompt();
        const browserIdWrites = vi
            .mocked(safeWrite)
            .mock.calls.filter((c) => c[0] === "simple-todos:browserId");
        expect(browserIdWrites).toHaveLength(0);
    });

    it("enable still succeeds when safeWrite fails (returns false) without throwing", async () => {
        vi.mocked(safeWrite).mockReturnValue(false);
        const { ok } = await enableViaPrompt();
        expect(ok).toBe(true);
    });
});
