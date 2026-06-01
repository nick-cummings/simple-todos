import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    backupFilename,
    BackupParseError,
    buildBackup,
    clearAllAppData,
    CURRENT_BACKUP_VERSION,
    MAX_BACKUP_ITEMS,
    parseBackup,
    writeBackupToStorage,
} from "./backup";
import { LABELS_STORAGE_KEY } from "./labels";
import { loadTodos, STORAGE_KEY } from "./todos";

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    vi.useRealTimers();
});

const sampleTodo = {
    completed: false,
    createdAt: 100,
    id: "t1",
    labels: [],
    title: "Task",
    updatedAt: 100,
};

const sampleLabel = {
    color: "blue" as const,
    createdAt: 1,
    name: "work",
};

describe("buildBackup / backupFilename", () => {
    it("buildBackup stamps version + ISO timestamp + payload", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-05-22T12:00:00Z"));
        const backup = buildBackup([sampleTodo], [sampleLabel]);
        expect(backup.version).toBe(CURRENT_BACKUP_VERSION);
        expect(backup.exportedAt).toBe("2026-05-22T12:00:00.000Z");
        expect(backup.todos).toEqual([sampleTodo]);
        expect(backup.labels).toEqual([sampleLabel]);
    });

    it("backupFilename uses local-time YYYY-MM-DD", () => {
        const fn = backupFilename(new Date(2026, 0, 5)); // Jan 5, local
        expect(fn).toBe("simple-todos-backup-2026-01-05.json");
    });
});

describe("parseBackup", () => {
    it("round-trips through stringify → parse", () => {
        const backup = buildBackup([sampleTodo], [sampleLabel]);
        const parsed = parseBackup(JSON.stringify(backup));
        expect(parsed.todos).toEqual(backup.todos);
        expect(parsed.labels).toEqual(backup.labels);
    });

    it("rejects non-JSON input", () => {
        expect(() => parseBackup("not json")).toThrow(BackupParseError);
        expect(() => parseBackup("not json")).toThrow(/valid JSON/);
    });

    it("rejects JSON arrays / primitives at the top level", () => {
        expect(() => parseBackup("[]")).toThrow(/object/);
        expect(() => parseBackup('"hi"')).toThrow(/object/);
    });

    it("rejects wrong version", () => {
        expect(() =>
            parseBackup(
                JSON.stringify({
                    exportedAt: "x",
                    labels: [],
                    todos: [],
                    version: 99,
                }),
            ),
        ).toThrow(/version/);
    });

    it("rejects when `todos` is missing or not an array of todo-shaped objects", () => {
        expect(() =>
            parseBackup(
                JSON.stringify({
                    exportedAt: "x",
                    labels: [],
                    version: CURRENT_BACKUP_VERSION,
                }),
            ),
        ).toThrow(/todos/);
        expect(() =>
            parseBackup(
                JSON.stringify({
                    exportedAt: "x",
                    labels: [],
                    todos: [{ wrong: "shape" }],
                    version: CURRENT_BACKUP_VERSION,
                }),
            ),
        ).toThrow(/todos/);
    });

    it("rejects when `labels` is missing or malformed", () => {
        expect(() =>
            parseBackup(
                JSON.stringify({
                    exportedAt: "x",
                    todos: [],
                    version: CURRENT_BACKUP_VERSION,
                }),
            ),
        ).toThrow(/labels/);
        expect(() =>
            parseBackup(
                JSON.stringify({
                    exportedAt: "x",
                    labels: [{ no: "color" }],
                    todos: [],
                    version: CURRENT_BACKUP_VERSION,
                }),
            ),
        ).toThrow(/labels/);
    });

    it("rejects a todo with a non-string description", () => {
        expect(() =>
            parseBackup(
                JSON.stringify({
                    exportedAt: "x",
                    labels: [],
                    todos: [{ ...sampleTodo, description: 123 }],
                    version: CURRENT_BACKUP_VERSION,
                }),
            ),
        ).toThrow(/todos/);
    });

    it("rejects a todo with a non-string dueDate", () => {
        expect(() =>
            parseBackup(
                JSON.stringify({
                    exportedAt: "x",
                    labels: [],
                    todos: [{ ...sampleTodo, dueDate: 20_260_529 }],
                    version: CURRENT_BACKUP_VERSION,
                }),
            ),
        ).toThrow(/todos/);
    });

    it("rejects a todo with a malformed recurrence", () => {
        expect(() =>
            parseBackup(
                JSON.stringify({
                    exportedAt: "x",
                    labels: [],
                    todos: [{ ...sampleTodo, recurrence: "weekly" }],
                    version: CURRENT_BACKUP_VERSION,
                }),
            ),
        ).toThrow(/todos/);
    });

    it("rejects a todo whose labels array holds non-string entries", () => {
        expect(() =>
            parseBackup(
                JSON.stringify({
                    exportedAt: "x",
                    labels: [],
                    todos: [{ ...sampleTodo, labels: ["ok", 7] }],
                    version: CURRENT_BACKUP_VERSION,
                }),
            ),
        ).toThrow(/todos/);
    });

    it("rejects an oversize todos array", () => {
        expect(() =>
            parseBackup(
                JSON.stringify({
                    exportedAt: "x",
                    labels: [],
                    todos: Array.from(
                        { length: MAX_BACKUP_ITEMS + 1 },
                        () => 0,
                    ),
                    version: CURRENT_BACKUP_VERSION,
                }),
            ),
        ).toThrow(/too many todos/);
    });

    it("rejects an oversize labels array", () => {
        expect(() =>
            parseBackup(
                JSON.stringify({
                    exportedAt: "x",
                    labels: Array.from(
                        { length: MAX_BACKUP_ITEMS + 1 },
                        () => 0,
                    ),
                    todos: [],
                    version: CURRENT_BACKUP_VERSION,
                }),
            ),
        ).toThrow(/too many labels/);
    });

    it("tolerates a missing exportedAt — fills with empty string", () => {
        const parsed = parseBackup(
            JSON.stringify({
                labels: [],
                todos: [],
                version: CURRENT_BACKUP_VERSION,
            }),
        );
        expect(parsed.exportedAt).toBe("");
    });
});

describe("parseBackup → writeBackupToStorage → loadTodos round-trip", () => {
    // The seam this whole change is about: anything parseBackup accepts
    // must survive loadTodos (which filters through isTodo). If the two
    // validators ever diverge again, an imported todo would be silently
    // dropped on the next load — the exact data-loss bug from #27.
    it("keeps every imported todo, including optional fields", () => {
        const fullTodo = {
            completed: true,
            createdAt: 100,
            description: "with notes",
            dueDate: "2026-05-29",
            id: "t-full",
            labels: ["work", "urgent"],
            recurrence: { every: 2, unit: "week" as const },
            title: "Recurring task",
            updatedAt: 200,
        };
        const backup = parseBackup(
            JSON.stringify(buildBackup([sampleTodo, fullTodo], [sampleLabel])),
        );
        expect(writeBackupToStorage(backup)).toBe(true);
        expect(loadTodos()).toEqual(backup.todos);
    });
});

describe("writeBackupToStorage", () => {
    it("writes the todos and labels under the app's storage keys", () => {
        const backup = buildBackup([sampleTodo], [sampleLabel]);
        writeBackupToStorage(backup);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([
            sampleTodo,
        ]);
        expect(
            JSON.parse(localStorage.getItem(LABELS_STORAGE_KEY) ?? "[]"),
        ).toEqual([sampleLabel]);
    });

    it("replaces (does not merge) prior content", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: "stale" }]));
        const backup = buildBackup([sampleTodo], [sampleLabel]);
        writeBackupToStorage(backup);
        const todos = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as {
            id: string;
        }[];
        expect(todos.map((t) => t.id)).toEqual(["t1"]);
    });
});

describe("clearAllAppData", () => {
    it("removes every `simple-todos:`-prefixed key", () => {
        localStorage.setItem("simple-todos:v1", "x");
        localStorage.setItem("simple-todos:labels:v1", "x");
        localStorage.setItem("simple-todos:theme", "dark");
        localStorage.setItem("unrelated:other", "keep me");
        const removed = clearAllAppData();
        expect(removed.toSorted()).toEqual([
            "simple-todos:labels:v1",
            "simple-todos:theme",
            "simple-todos:v1",
        ]);
        expect(localStorage.getItem("unrelated:other")).toBe("keep me");
    });

    it("is a no-op when there is no app data", () => {
        expect(clearAllAppData()).toEqual([]);
    });
});
