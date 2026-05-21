"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  DEFAULT_COLOR,
  findLabelByName,
  type Label,
  type LabelColor,
  LABELS_STORAGE_KEY,
  loadLabels,
  migrateLabelsFromTodos,
  normalizeLabelName,
  saveLabels,
} from "./labels";
import { isBrowser } from "./runtime";
import { loadTodos, saveTodos, STORAGE_KEY, type Todo } from "./todos";

const EMPTY: Label[] = [];
let cache: Label[] | null = null;
const listeners = new Set<() => void>();

export function useLabels() {
  const labels = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const hydrated = labels !== EMPTY || (isBrowser() && cache !== null);

  const addLabel = useCallback(
    (name: string, color: LabelColor = DEFAULT_COLOR): Label | null => {
      const trimmed = normalizeLabelName(name);
      if (!trimmed) return null;
      let added: Label | null = null;
      mutate((prev) => {
        if (findLabelByName(prev, trimmed)) return prev;
        added = { color, createdAt: Date.now(), name: trimmed };
        return [...prev, added];
      });
      return added;
    },
    [],
  );

  const renameLabel = useCallback((oldName: string, newName: string) => {
    const trimmedOld = normalizeLabelName(oldName);
    const trimmedNew = normalizeLabelName(newName);
    if (!trimmedNew || trimmedOld === trimmedNew) return;
    const oldKey = trimmedOld.toLowerCase();
    const newKey = trimmedNew.toLowerCase();
    mutate((prev) => {
      // Reject if a *different* label with the new name already exists.
      const collision = prev.find(
        (l) =>
          l.name.toLowerCase() === newKey && l.name.toLowerCase() !== oldKey,
      );
      if (collision) return prev;
      let changed = 0;
      const next = prev.map((l) => {
        if (l.name.toLowerCase() === oldKey) {
          changed += 1;
          return { ...l, name: trimmedNew };
        }
        return l;
      });
      return changed === 0 ? prev : next;
    });
    // Propagate rename to every todo's label list.
    rewriteTodoLabels((labelList) => {
      let touched = 0;
      const next = labelList.map((l) => {
        if (l.toLowerCase() === oldKey) {
          touched += 1;
          return trimmedNew;
        }
        return l;
      });
      return touched === 0 ? labelList : next;
    });
  }, []);

  const recolorLabel = useCallback((name: string, color: LabelColor) => {
    const key = normalizeLabelName(name).toLowerCase();
    if (!key) return;
    mutate((prev) =>
      prev.map((l) => (l.name.toLowerCase() === key ? { ...l, color } : l)),
    );
  }, []);

  const deleteLabel = useCallback((name: string) => {
    const key = normalizeLabelName(name).toLowerCase();
    if (!key) return;
    mutate((prev) => prev.filter((l) => l.name.toLowerCase() !== key));
    rewriteTodoLabels((labelList) => {
      const next = labelList.filter((l) => l.toLowerCase() !== key);
      return next.length === labelList.length ? labelList : next;
    });
  }, []);

  /**
   * Make sure each name has a registry record. Called when a todo is
   * created or edited with a label that isn't in the registry yet.
   * New labels get the default gray color.
   */
  const ensureLabelsExist = useCallback((names: string[]) => {
    if (names.length === 0) return;
    mutate((prev) => {
      const existingKeys = new Set(prev.map((l) => l.name.toLowerCase()));
      const additions: Label[] = [];
      let stamp = Date.now();
      for (const raw of names) {
        const trimmed = normalizeLabelName(raw);
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        additions.push({
          color: DEFAULT_COLOR,
          createdAt: stamp++,
          name: trimmed,
        });
      }
      return additions.length === 0 ? prev : [...prev, ...additions];
    });
  }, []);

  return {
    addLabel,
    deleteLabel,
    ensureLabelsExist,
    hydrated,
    labels,
    recolorLabel,
    renameLabel,
  };
}

function emit() {
  for (const l of listeners) l();
}

function getServerSnapshot(): Label[] {
  return EMPTY;
}

function getSnapshot(): Label[] {
  if (!isBrowser()) return EMPTY;
  if (cache === null) {
    let stored = loadLabels();
    // First-run migration: derive label records from any todos that
    // already have label strings but no registry yet.
    if (stored.length === 0) {
      const todos = loadTodos();
      if (todos.length > 0) {
        const derived = migrateLabelsFromTodos(todos.map((t) => t.labels));
        if (derived.length > 0) {
          stored = derived;
          saveLabels(stored);
        }
      }
    }
    cache = stored;
  }
  return cache;
}

function mutate(updater: (prev: Label[]) => Label[]) {
  const prev = getSnapshot();
  const next = updater(prev);
  if (next === prev) return;
  cache = next;
  saveLabels(next);
  emit();
}

/**
 * Rewrite todo label strings as a side effect of renaming or
 * deleting a label. We use loadTodos/saveTodos directly so this
 * works without coupling the hook to useTodos's internal cache.
 * After saving, the storage event will sync any open useTodos
 * subscribers in the same tab via the storage listener.
 */
function rewriteTodoLabels(updater: (todoLabels: string[]) => string[]) {
  const todos = loadTodos();
  // Counter (not boolean) so TS doesn't narrow the literal `false`
  // through the map closure and then flag the post-loop check as
  // always-truthy.
  let touched = 0;
  const next: Todo[] = todos.map((t) => {
    const updated = updater(t.labels);
    if (updated === t.labels) return t;
    touched += 1;
    return { ...t, labels: updated, updatedAt: Date.now() };
  });
  if (touched === 0) return;
  saveTodos(next);
  // Same-tab listeners on useTodos won't fire on programmatic
  // localStorage writes, so dispatch a fake storage event so the
  // cache invalidates.
  globalThis.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LABELS_STORAGE_KEY) {
      cache = loadLabels();
      emit();
    }
  };
  globalThis.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener("storage", onStorage);
  };
}
