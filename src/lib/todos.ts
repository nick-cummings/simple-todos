export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  labels: string[];
  createdAt: number;
  updatedAt: number;
};

export type SortKey = "createdDesc" | "createdAsc" | "titleAsc" | "completed";

export const STORAGE_KEY = "simple-todos:v1";

export function createTodo(title: string, labels: string[] = []): Todo {
  const now = Date.now();
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${now}-${Math.random().toString(36).slice(2, 10)}`,
    title: title.trim(),
    completed: false,
    labels: dedupeLabels(labels),
    createdAt: now,
    updatedAt: now,
  };
}

export function dedupeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = raw.trim().toLowerCase();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

export function parseLabelsInput(input: string): string[] {
  return dedupeLabels(input.split(/[,\s]+/));
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
    if (q && !t.title.toLowerCase().includes(q)) return false;
    if (activeLabels.length === 0) return true;
    return activeLabels.every((l) => t.labels.includes(l));
  });
}

export function allLabels(todos: Todo[]): string[] {
  const set = new Set<string>();
  for (const t of todos) for (const l of t.labels) set.add(l);
  return [...set].sort();
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
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.completed === "boolean" &&
    Array.isArray(o.labels) &&
    typeof o.createdAt === "number" &&
    typeof o.updatedAt === "number"
  );
}
