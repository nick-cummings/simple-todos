"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  type Label,
  type LabelColor,
  DEFAULT_COLOR,
  LABELS_STORAGE_KEY,
  findLabelByName,
  loadLabels,
  migrateLabelsFromTodos,
  normalizeLabelName,
  saveLabels,
} from "./labels";
import { STORAGE_KEY, loadTodos, saveTodos, type Todo } from "./todos";

const EMPTY: Label[] = [];
let cache: Label[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function getSnapshot(): Label[] {
  if (typeof window === "undefined") return EMPTY;
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

function getServerSnapshot(): Label[] {
  return EMPTY;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LABELS_STORAGE_KEY) {
      cache = loadLabels();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
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
  let changed = false;
  const next: Todo[] = todos.map((t) => {
    const updated = updater(t.labels);
    if (updated === t.labels) return t;
    changed = true;
    return { ...t, labels: updated, updatedAt: Date.now() };
  });
  if (!changed) return;
  saveTodos(next);
  // Same-tab listeners on useTodos won't fire on programmatic
  // localStorage writes, so dispatch a fake storage event so the
  // cache invalidates.
  window.dispatchEvent(
    new StorageEvent("storage", { key: STORAGE_KEY }),
  );
}

export function useLabels() {
  const labels = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated =
    labels !== EMPTY || (typeof window !== "undefined" && cache !== null);

  const addLabel = useCallback(
    (name: string, color: LabelColor = DEFAULT_COLOR): Label | null => {
      const trimmed = normalizeLabelName(name);
      if (!trimmed) return null;
      let added: Label | null = null;
      mutate((prev) => {
        if (findLabelByName(prev, trimmed)) return prev;
        added = { name: trimmed, color, createdAt: Date.now() };
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
        (l) => l.name.toLowerCase() === newKey && l.name.toLowerCase() !== oldKey,
      );
      if (collision) return prev;
      let changed = false;
      const next = prev.map((l) => {
        if (l.name.toLowerCase() === oldKey) {
          changed = true;
          return { ...l, name: trimmedNew };
        }
        return l;
      });
      return changed ? next : prev;
    });
    // Propagate rename to every todo's label list.
    rewriteTodoLabels((labelList) => {
      let touched = false;
      const next = labelList.map((l) => {
        if (l.toLowerCase() === oldKey) {
          touched = true;
          return trimmedNew;
        }
        return l;
      });
      return touched ? next : labelList;
    });
  }, []);

  const recolorLabel = useCallback(
    (name: string, color: LabelColor) => {
      const key = normalizeLabelName(name).toLowerCase();
      if (!key) return;
      mutate((prev) =>
        prev.map((l) =>
          l.name.toLowerCase() === key ? { ...l, color } : l,
        ),
      );
    },
    [],
  );

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
          name: trimmed,
          color: DEFAULT_COLOR,
          createdAt: stamp++,
        });
      }
      return additions.length === 0 ? prev : [...prev, ...additions];
    });
  }, []);

  return {
    labels,
    hydrated,
    addLabel,
    renameLabel,
    recolorLabel,
    deleteLabel,
    ensureLabelsExist,
  };
}
