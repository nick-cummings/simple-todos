"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  STORAGE_KEY,
  Todo,
  TodoInput,
  createTodo,
  dedupeLabels,
  loadTodos,
  saveTodos,
} from "./todos";

const EMPTY: Todo[] = [];
let cache: Todo[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function getSnapshot(): Todo[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache === null) cache = loadTodos();
  return cache;
}

function getServerSnapshot(): Todo[] {
  return EMPTY;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = loadTodos();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function mutate(updater: (prev: Todo[]) => Todo[]) {
  const prev = getSnapshot();
  const next = updater(prev);
  if (next === prev) return;
  cache = next;
  saveTodos(next);
  emit();
}

export type TodoPatch = Partial<
  Pick<Todo, "title" | "description" | "dueDate" | "labels" | "completed">
>;

export function useTodos() {
  const todos = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated =
    todos !== EMPTY || (typeof window !== "undefined" && cache !== null);

  const add = useCallback((input: TodoInput) => {
    if (!input.title.trim()) return;
    mutate((prev) => [createTodo(input), ...prev]);
  }, []);

  const update = useCallback((id: string, patch: TodoPatch) => {
    mutate((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              ...patch,
              labels: patch.labels ? dedupeLabels(patch.labels) : t.labels,
              updatedAt: Date.now(),
            }
          : t,
      ),
    );
  }, []);

  const toggle = useCallback((id: string) => {
    mutate((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, completed: !t.completed, updatedAt: Date.now() }
          : t,
      ),
    );
  }, []);

  const remove = useCallback((id: string) => {
    mutate((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    mutate((prev) => prev.filter((t) => !t.completed));
  }, []);

  return { todos, hydrated, add, update, toggle, remove, clearCompleted };
}
