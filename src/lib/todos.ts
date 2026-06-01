import { toISODate } from "./dates";
import { isBrowser } from "./runtime";
import { safeWrite } from "./storage";

export interface Recurrence {
    every: number; // ≥1
    unit: RecurrenceUnit;
}

export type RecurrenceUnit = "day" | "month" | "week";

export type SortKey =
    | "completed"
    | "createdAsc"
    | "createdDesc"
    | "dueDate"
    | "titleAsc";

export interface Todo {
    completed: boolean;
    createdAt: number;
    description?: string;
    dueDate?: string; // ISO YYYY-MM-DD
    id: string;
    labels: string[];
    recurrence?: Recurrence;
    title: string;
    updatedAt: number;
}

export interface TodoInput {
    description?: string;
    dueDate?: string;
    labels?: string[];
    recurrence?: Recurrence;
    title: string;
}

export const STORAGE_KEY = "simple-todos:v1";

export type StatusFilter = "done" | "open";

export function allLabels(todos: Todo[]): string[] {
    const set = new Set<string>();
    for (const t of todos) for (const l of t.labels) set.add(l);
    return [...set].toSorted((a, b) => a.localeCompare(b));
}

export function createTodo(input: TodoInput): Todo {
    const now = Date.now();
    return {
        completed: false,
        createdAt: now,
        description: normalizeOptional(input.description),
        dueDate: normalizeOptional(input.dueDate),
        id: makeTodoId(now),
        labels: dedupeLabels(input.labels ?? []),
        recurrence: normalizeRecurrence(input.recurrence),
        title: input.title.trim(),
        updatedAt: now,
    };
}

export function dedupeLabels(labels: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of labels) {
        const label = normalizeLabel(raw);
        if (!label) continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(label);
    }
    return out;
}

export function filterTodos(
    todos: Todo[],
    activeLabels: string[],
    query: string,
    activeStatuses: ReadonlySet<StatusFilter> = new Set(),
): Todo[] {
    const q = query.trim().toLowerCase();
    // Selection acts like checkboxes: empty OR both checked means "show
    // everything", single selection narrows to that status.
    const wantOpen = activeStatuses.size === 0 || activeStatuses.has("open");
    const wantDone = activeStatuses.size === 0 || activeStatuses.has("done");
    return todos.filter((t) => {
        if (t.completed ? !wantDone : !wantOpen) return false;
        if (q) {
            const hay = `${t.title} ${t.description ?? ""}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        if (activeLabels.length === 0) return true;
        // Multiple labels selected = OR. A todo matches if it carries any
        // of the selected labels (case-insensitive).
        const todoKeys = new Set(t.labels.map((l) => l.toLowerCase()));
        return activeLabels.some((l) => todoKeys.has(l.toLowerCase()));
    });
}

export function isRecurrence(v: unknown): v is Recurrence {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    if (typeof o.every !== "number" || o.every < 1) return false;
    if (o.unit !== "day" && o.unit !== "week" && o.unit !== "month")
        return false;
    return true;
}

export function isTodo(v: unknown): v is Todo {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    if (
        typeof o.id !== "string" ||
        typeof o.title !== "string" ||
        typeof o.completed !== "boolean" ||
        !Array.isArray(o.labels) ||
        !o.labels.every((l) => typeof l === "string") ||
        typeof o.createdAt !== "number" ||
        typeof o.updatedAt !== "number"
    ) {
        return false;
    }
    if (o.description !== undefined && typeof o.description !== "string")
        return false;
    if (o.dueDate !== undefined && typeof o.dueDate !== "string") return false;
    if (o.recurrence !== undefined && !isRecurrence(o.recurrence)) return false;
    return true;
}

export function labelCounts(todos: Todo[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const t of todos) {
        if (t.completed) continue;
        for (const l of t.labels) m.set(l, (m.get(l) ?? 0) + 1);
    }
    return m;
}

export function loadTodos(): Todo[] {
    if (!isBrowser()) return [];
    try {
        const raw = globalThis.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isTodo);
    } catch {
        return [];
    }
}

/**
 * Compute the next occurrence ISO date given a starting ISO date and
 * a recurrence rule. Returns YYYY-MM-DD. Month/week math anchors on
 * the given day-of-month or day-of-week.
 */
export function nextOccurrence(iso: string, r: Recurrence): string {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    const date = new Date(y, m - 1, d);
    switch (r.unit) {
        case "day": {
            date.setDate(date.getDate() + r.every);
            break;
        }
        case "month": {
            date.setMonth(date.getMonth() + r.every);
            break;
        }
        case "week": {
            date.setDate(date.getDate() + 7 * r.every);
            break;
        }
    }
    return toISODate(date);
}

export function normalizeLabel(raw: string): string {
    // Trim and collapse whitespace, but preserve casing — uniqueness
    // is enforced case-insensitively in dedupeLabels.
    return raw.trim().replaceAll(/\s+/g, " ");
}

/**
 * Human-readable cadence label, e.g. "Daily", "Every 2 weeks".
 * Singular every-1 forms are collapsed.
 */
export function recurrenceLabel(r: Recurrence): string {
    if (r.every === 1) {
        if (r.unit === "day") return "Daily";
        if (r.unit === "week") return "Weekly";
        return "Monthly";
    }
    const plurals: Record<RecurrenceUnit, string> = {
        day: "days",
        month: "months",
        week: "weeks",
    };
    return `Every ${r.every} ${plurals[r.unit]}`;
}

export function saveTodos(todos: Todo[]): boolean {
    if (!isBrowser()) return false;
    return safeWrite(STORAGE_KEY, JSON.stringify(todos));
}

export function sortTodos(todos: Todo[], sort: SortKey): Todo[] {
    switch (sort) {
        case "completed": {
            return todos.toSorted((a, b) => {
                if (a.completed === b.completed)
                    return b.createdAt - a.createdAt;
                return a.completed ? 1 : -1;
            });
        }
        case "createdAsc": {
            return todos.toSorted((a, b) => a.createdAt - b.createdAt);
        }
        case "dueDate": {
            return todos.toSorted((a, b) => {
                if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt;
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate.localeCompare(b.dueDate);
            });
        }
        case "titleAsc": {
            return todos.toSorted((a, b) => a.title.localeCompare(b.title));
        }
        default: {
            // "createdDesc" — also the fallback for any unknown key.
            return todos.toSorted((a, b) => b.createdAt - a.createdAt);
        }
    }
}

function makeTodoId(now: number): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    // Non-cryptographic fallback for environments without crypto.randomUUID.
    // Math.random is sufficient for client-side todo IDs; collisions are
    // functionally impossible at this scale and security is irrelevant.
    // eslint-disable-next-line sonarjs/pseudo-random
    const suffix = Math.random().toString(36).slice(2, 10);
    return `${now}-${suffix}`;
}

function normalizeOptional(v: string | undefined): string | undefined {
    if (v === undefined) return undefined;
    const t = v.trim();
    return t === "" ? undefined : t;
}

// Set-based check so callers passing untyped input (form state,
// localStorage) get runtime validation without tripping
// no-unnecessary-condition.
const VALID_UNITS: ReadonlySet<string> = new Set(["day", "month", "week"]);

function normalizeRecurrence(
    r: Recurrence | undefined,
): Recurrence | undefined {
    if (!r) return undefined;
    const every = Math.floor(r.every);
    if (!Number.isFinite(every) || every < 1) return undefined;
    if (!VALID_UNITS.has(r.unit)) return undefined;
    return { every, unit: r.unit };
}
