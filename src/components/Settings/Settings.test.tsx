import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type Label, LABELS_STORAGE_KEY } from "@/lib/labels";
import { STORAGE_KEY, type Todo } from "@/lib/todos";

// Controllable stub for useReminders so the Settings UI can be
// driven into each branch (active / off / denied) without touching
// real notification APIs.
const reminderState = {
    active: false,
    disable: vi.fn<() => Promise<void>>(),
    enable: vi.fn<() => Promise<boolean>>(),
    needsAttention: false,
    permission: "prompt" as "denied" | "granted" | "prompt" | "unsupported",
    syncTodoReminder: vi.fn<(t: Todo) => Promise<void>>(),
};

vi.mock("@/lib/useReminders", () => ({
    useReminders: () => reminderState,
}));

async function renderSettings() {
    vi.resetModules();
    const mod = await import("./Settings");
    const Settings = mod.default;
    return { user: userEvent.setup(), ...render(<Settings />) };
}

function seedLabels(labels: Label[]) {
    localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(labels));
}
function seedTodos(todos: Todo[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

beforeEach(() => {
    localStorage.clear();
    reminderState.active = false;
    reminderState.permission = "prompt";
    reminderState.disable = vi.fn<() => Promise<void>>();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("<Settings> — reminders section", () => {
    it("hides the Disable button when reminders are off", async () => {
        await renderSettings();
        expect(
            screen.queryByRole("button", { name: /disable reminders/i }),
        ).toBeNull();
        expect(screen.getByText(/reminders are off/i)).toBeInTheDocument();
    });

    it("shows a 'blocked' hint when permission is denied", async () => {
        reminderState.permission = "denied";
        await renderSettings();
        expect(
            screen.getByText(/blocked in your browser/i),
        ).toBeInTheDocument();
    });

    it("shows Disable button when reminders are active and calls disable()", async () => {
        reminderState.active = true;
        reminderState.permission = "granted";
        const { user } = await renderSettings();
        await user.click(
            screen.getByRole("button", { name: /disable reminders/i }),
        );
        await waitFor(() => {
            expect(reminderState.disable).toHaveBeenCalledTimes(1);
        });
    });
});

describe("<Settings> — backup section", () => {
    it("exports the current data as a JSON file", async () => {
        seedTodos([
            {
                completed: false,
                createdAt: 1,
                id: "a",
                labels: [],
                title: "T1",
                updatedAt: 1,
            },
        ]);
        seedLabels([{ color: "blue", createdAt: 1, name: "work" }]);
        // Stub URL.createObjectURL/revokeObjectURL and the anchor click,
        // and capture the Blob the component passes.
        const blobs: Blob[] = [];
        const originalCreate = URL.createObjectURL;
        URL.createObjectURL = vi.fn<typeof URL.createObjectURL>((b) => {
            blobs.push(b as Blob);
            return "blob:fake";
        });
        URL.revokeObjectURL = vi.fn();
        const anchorClick = vi.fn();
        // Lint flags createElement as deprecated (it conflates DOM API
        // with React's deprecated createElement); the DOM API is the
        // intended call here.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const origCreate = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation(
            (tag: string) => {
                const el = origCreate(tag);
                if (tag === "a") {
                    Object.defineProperty(el, "click", { value: anchorClick });
                }
                return el;
            },
        );

        try {
            const { user } = await renderSettings();
            await user.click(
                screen.getByRole("button", { name: /export to json/i }),
            );
            await waitFor(() => {
                expect(anchorClick).toHaveBeenCalledTimes(1);
            });
            expect(blobs.length).toBe(1);
            const text = await blobs[0]!.text();
            const parsed = JSON.parse(text) as {
                labels: Label[];
                todos: Todo[];
                version: number;
            };
            expect(parsed.version).toBe(1);
            expect(parsed.todos.map((t) => t.id)).toEqual(["a"]);
            expect(parsed.labels.map((l) => l.name)).toEqual(["work"]);
        } finally {
            URL.createObjectURL = originalCreate;
        }
    });

    it("surfaces a friendly error when import file is malformed", async () => {
        const { user } = await renderSettings();
        const fileInput = screen.getByLabelText(
            /backup file/i,
        ) as HTMLInputElement;
        const badFile = new File(["{ not valid"], "bad.json", {
            type: "application/json",
        });
        await user.upload(fileInput, badFile);
        expect(await screen.findByRole("alert")).toHaveTextContent(
            /valid JSON/i,
        );
    });

    it("rejects an import with the wrong version", async () => {
        const { user } = await renderSettings();
        const fileInput = screen.getByLabelText(
            /backup file/i,
        ) as HTMLInputElement;
        const wrongVersion = new File(
            [JSON.stringify({ labels: [], todos: [], version: 99 })],
            "wrong.json",
            { type: "application/json" },
        );
        await user.upload(fileInput, wrongVersion);
        expect(await screen.findByRole("alert")).toHaveTextContent(/version/i);
    });

    it("shows a confirmation before replacing data with a valid import", async () => {
        const { user } = await renderSettings();
        const fileInput = screen.getByLabelText(
            /backup file/i,
        ) as HTMLInputElement;
        const goodFile = new File(
            [
                JSON.stringify({
                    exportedAt: "2026-05-22T00:00:00Z",
                    labels: [{ color: "blue", createdAt: 1, name: "work" }],
                    todos: [
                        {
                            completed: false,
                            createdAt: 1,
                            id: "x",
                            labels: [],
                            title: "From backup",
                            updatedAt: 1,
                        },
                    ],
                    version: 1,
                }),
            ],
            "good.json",
            { type: "application/json" },
        );
        await user.upload(fileInput, goodFile);
        // Confirmation dialog appears with the count summary.
        const dialog = await screen.findByRole("dialog");
        expect(dialog).toHaveTextContent(/1 todos and 1 labels/i);
        // User cancels — no write occurs.
        await user.click(screen.getByRole("button", { name: /^cancel$/i }));
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("writes the imported data to storage after confirming", async () => {
        const { user } = await renderSettings();
        const fileInput = screen.getByLabelText(
            /backup file/i,
        ) as HTMLInputElement;
        const goodFile = new File(
            [
                JSON.stringify({
                    exportedAt: "x",
                    labels: [{ color: "blue", createdAt: 1, name: "work" }],
                    todos: [
                        {
                            completed: false,
                            createdAt: 1,
                            id: "x",
                            labels: ["work"],
                            title: "From backup",
                            updatedAt: 1,
                        },
                    ],
                    version: 1,
                }),
            ],
            "good.json",
            { type: "application/json" },
        );
        await user.upload(fileInput, goodFile);
        await screen.findByRole("dialog");
        await user.click(screen.getByRole("button", { name: /replace data/i }));
        await waitFor(() => {
            const todos = JSON.parse(
                localStorage.getItem(STORAGE_KEY) ?? "[]",
            ) as Todo[];
            expect(todos.map((t) => t.id)).toEqual(["x"]);
        });
        expect(await screen.findByRole("status")).toHaveTextContent(
            /imported/i,
        );
    });
});

describe("<Settings> — clear all data", () => {
    it("shows a confirmation, cancels without clearing, and clears + reloads on confirm", async () => {
        seedTodos([
            {
                completed: false,
                createdAt: 1,
                id: "a",
                labels: [],
                title: "T",
                updatedAt: 1,
            },
        ]);
        const reload = vi.fn();
        const assign = vi.fn();
        const original = globalThis.location;
        // happy-dom's Location is a class instance; spread loses the
        // prototype. Object.assign onto an inheriting object preserves it.
        const stub = Object.assign(
            Object.create(
                Object.getPrototypeOf(original) as object,
            ) as Location,
            original,
            { assign, reload },
        );
        Object.defineProperty(globalThis, "location", {
            configurable: true,
            value: stub,
            writable: true,
        });
        try {
            const { user } = await renderSettings();
            await user.click(
                screen.getByRole("button", { name: /clear all data/i }),
            );
            // Cancel first.
            await user.click(screen.getByRole("button", { name: /^cancel$/i }));
            expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
            // Open + confirm.
            await user.click(
                screen.getByRole("button", { name: /clear all data/i }),
            );
            await user.click(
                screen.getByRole("button", { name: /clear everything/i }),
            );
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
            expect(assign).toHaveBeenCalledWith("/");
        } finally {
            Object.defineProperty(globalThis, "location", {
                configurable: true,
                value: original,
                writable: true,
            });
        }
    });
});

describe("<Settings> — chrome", () => {
    it("renders the app version from package.json", async () => {
        await renderSettings();
        expect(
            screen.getByText(/simple todos · v\d+\.\d+\.\d+/i),
        ).toBeVisible();
    });

    it("has a back link to '/'", async () => {
        await renderSettings();
        const back = screen.getByRole("link", { name: /back to todos/i });
        expect(back).toHaveAttribute("href", "/");
    });
});
