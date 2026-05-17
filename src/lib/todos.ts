export type Todo = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string; // ISO YYYY-MM-DD (date-only, no timezone confusion)
  completed: boolean;
  labels: string[];
  createdAt: number;
  updatedAt: number;
};

export type TodoInput = {
  title: string;
  description?: string;
  dueDate?: string;
  labels?: string[];
};

export type SortKey =
  | "createdDesc"
  | "createdAsc"
  | "titleAsc"
  | "completed"
  | "dueDate";

export const STORAGE_KEY = "simple-todos:v1";

export function createTodo(input: TodoInput): Todo {
  const now = Date.now();
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${now}-${Math.random().toString(36).slice(2, 10)}`,
    title: input.title.trim(),
    description: normalizeOptional(input.description),
    dueDate: normalizeOptional(input.dueDate),
    completed: false,
    labels: dedupeLabels(input.labels ?? []),
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function dedupeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = normalizeLabel(raw);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

function normalizeOptional(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

export function sortTodos(todos: Todo[], sort: SortKey): Todo[] {
  const copy = [...todos];
  switch (sort) {
    case "createdAsc":
      return copy.sort((a, b) => a.createdAt - b.createdAt);
    case "titleAsc":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "completed":
      return copy.sort((a, b) => {
        if (a.completed === b.completed) return b.createdAt - a.createdAt;
        return a.completed ? 1 : -1;
      });
    case "dueDate":
      return copy.sort((a, b) => {
        // Todos with no due date sink to the bottom.
        if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    case "createdDesc":
    default:
      return copy.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export function filterTodos(
  todos: Todo[],
  activeLabels: string[],
  query: string,
): Todo[] {
  const q = query.trim().toLowerCase();
  return todos.filter((t) => {
    if (q) {
      const hay = `${t.title} ${t.description ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (activeLabels.length === 0) return true;
    return activeLabels.every((l) => t.labels.includes(l));
  });
}

export function allLabels(todos: Todo[]): string[] {
  const set = new Set<string>();
  for (const t of todos) for (const l of t.labels) set.add(l);
  return [...set].sort();
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDueDate(iso: string): string {
  // Parse as local date (avoid UTC shift).
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function isOverdue(iso: string | undefined, completed: boolean): boolean {
  if (!iso || completed) return false;
  return iso < todayISO();
}

export function loadTodos(): Todo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTodo);
  } catch {
    return [];
  }
}

export function saveTodos(todos: Todo[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function isTodo(v: unknown): v is Todo {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.title !== "string" ||
    typeof o.completed !== "boolean" ||
    !Array.isArray(o.labels) ||
    typeof o.createdAt !== "number" ||
    typeof o.updatedAt !== "number"
  ) {
    return false;
  }
  if (o.description !== undefined && typeof o.description !== "string") return false;
  if (o.dueDate !== undefined && typeof o.dueDate !== "string") return false;
  return true;
}
