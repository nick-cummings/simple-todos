"use client";

import { useCallback, useSyncExternalStore } from "react";

import { isBrowser } from "./runtime";
import {
  createTodo,
  dedupeLabels,
  loadTodos,
  saveTodos,
  STORAGE_KEY,
  Todo,
  TodoInput,
} from "./todos";

const EMPTY: Todo[] = [];
let cache: null | Todo[] = null;
const listeners = new Set<() => void>();

export type TodoPatch = Partial<
  Pick<Todo, "completed" | "description" | "dueDate" | "labels" | "title">
>;

export function useTodos() {
  const todos = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = todos !== EMPTY || (isBrowser() && cache !== null);

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

  // Restore a previously-removed todo verbatim — preserves id,
  // createdAt, and labels. Used by the undo-toast flow so the
  // restored todo looks like nothing happened. Inserted at the head
  // for simplicity; preserving the original position would require
  // capturing the index at remove time.
  const restore = useCallback((todo: Todo) => {
    mutate((prev) =>
      prev.some((t) => t.id === todo.id) ? prev : [todo, ...prev],
    );
  }, []);

  const clearCompleted = useCallback(() => {
    mutate((prev) => prev.filter((t) => !t.completed));
  }, []);

  return {
    add,
    clearCompleted,
    hydrated,
    remove,
    restore,
    todos,
    toggle,
    update,
  };
}

function emit() {
  for (const l of listeners) l();
}

function getServerSnapshot(): Todo[] {
  return EMPTY;
}

function getSnapshot(): Todo[] {
  if (!isBrowser()) return EMPTY;
  cache ??= loadTodos();
  return cache;
}

function mutate(updater: (prev: Todo[]) => Todo[]) {
  const prev = getSnapshot();
  const next = updater(prev);
  if (next === prev) return;
  cache = next;
  saveTodos(next);
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = loadTodos();
      emit();
    }
  };
  globalThis.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener("storage", onStorage);
  };
}
