import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_COLOR,
  LABELS_STORAGE_KEY,
  type Label,
} from "./labels";
import { STORAGE_KEY, type Todo } from "./todos";

async function importUseLabels() {
  vi.resetModules();
  return (await import("./useLabels")).useLabels;
}

function seedLabels(labels: Label[]) {
  localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(labels));
}

function seedTodos(todos: Todo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function readTodos(): Todo[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useLabels", () => {
  it("hydrates to empty when storage is empty", async () => {
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    expect(result.current.labels).toEqual([]);
  });

  it("reads existing labels from storage on mount", async () => {
    seedLabels([{ name: "work", color: "blue", createdAt: 1 }]);
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    expect(result.current.labels).toEqual([
      { name: "work", color: "blue", createdAt: 1 },
    ]);
  });

  it("first-run migration derives label records from existing todos", async () => {
    const todos: Todo[] = [
      {
        id: "1",
        title: "x",
        completed: false,
        labels: ["work", "home"],
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    seedTodos(todos);
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    const names = result.current.labels.map((l) => l.name).sort();
    expect(names).toEqual(["home", "work"]);
    // Migration also persists so subsequent reloads don't re-derive.
    const persisted = JSON.parse(
      localStorage.getItem(LABELS_STORAGE_KEY) || "[]",
    );
    expect(persisted.map((l: Label) => l.name).sort()).toEqual(["home", "work"]);
  });

  it("addLabel adds and persists a new label", async () => {
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    act(() => {
      result.current.addLabel("Work", "blue");
    });
    expect(result.current.labels).toHaveLength(1);
    expect(result.current.labels[0]).toMatchObject({
      name: "Work",
      color: "blue",
    });
    const persisted = JSON.parse(
      localStorage.getItem(LABELS_STORAGE_KEY) || "[]",
    );
    expect(persisted[0].name).toBe("Work");
  });

  it("addLabel ignores empty/whitespace names", async () => {
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    act(() => {
      result.current.addLabel("   ");
    });
    expect(result.current.labels).toEqual([]);
  });

  it("addLabel is a no-op when a same-name label already exists", async () => {
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    act(() => {
      result.current.addLabel("Work", "blue");
    });
    act(() => {
      result.current.addLabel("work", "red");
    });
    expect(result.current.labels).toHaveLength(1);
    expect(result.current.labels[0].color).toBe("blue");
  });

  it("renameLabel updates the registry and rewrites todo labels", async () => {
    seedTodos([
      {
        id: "1",
        title: "x",
        completed: false,
        labels: ["work", "other"],
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    seedLabels([
      { name: "work", color: "blue", createdAt: 1 },
      { name: "other", color: "gray", createdAt: 1 },
    ]);
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    act(() => {
      result.current.renameLabel("work", "Work-renamed");
    });
    const names = result.current.labels.map((l) => l.name).sort();
    expect(names).toEqual(["Work-renamed", "other"]);
    const todos = readTodos();
    expect(todos[0].labels).toEqual(["Work-renamed", "other"]);
  });

  it("renameLabel is rejected when the new name collides with a different label", async () => {
    seedLabels([
      { name: "work", color: "blue", createdAt: 1 },
      { name: "home", color: "red", createdAt: 2 },
    ]);
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    act(() => {
      result.current.renameLabel("work", "home");
    });
    const names = result.current.labels.map((l) => l.name).sort();
    expect(names).toEqual(["home", "work"]);
  });

  it("recolorLabel changes the color in place (case-insensitive name match)", async () => {
    seedLabels([{ name: "Work", color: "blue", createdAt: 1 }]);
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    act(() => {
      result.current.recolorLabel("work", "red");
    });
    expect(result.current.labels[0]).toMatchObject({
      name: "Work",
      color: "red",
    });
  });

  it("deleteLabel removes the label and strips it from every todo", async () => {
    seedTodos([
      {
        id: "1",
        title: "x",
        completed: false,
        labels: ["work", "home"],
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "2",
        title: "y",
        completed: false,
        labels: ["home"],
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    seedLabels([
      { name: "work", color: "blue", createdAt: 1 },
      { name: "home", color: "red", createdAt: 2 },
    ]);
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    act(() => {
      result.current.deleteLabel("work");
    });
    expect(result.current.labels.map((l) => l.name)).toEqual(["home"]);
    const todos = readTodos();
    expect(todos[0].labels).toEqual(["home"]);
    expect(todos[1].labels).toEqual(["home"]);
  });

  it("ensureLabelsExist adds missing labels and skips existing ones", async () => {
    seedLabels([{ name: "work", color: "blue", createdAt: 1 }]);
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    act(() => {
      result.current.ensureLabelsExist(["work", "home", "WORK", "  ", ""]);
    });
    const names = result.current.labels.map((l) => l.name).sort();
    expect(names).toEqual(["home", "work"]);
    const home = result.current.labels.find((l) => l.name === "home");
    expect(home?.color).toBe(DEFAULT_COLOR);
  });

  it("ignores storage events for unrelated keys", async () => {
    seedLabels([{ name: "work", color: "blue", createdAt: 1 }]);
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    act(() => {
      localStorage.setItem(
        LABELS_STORAGE_KEY,
        JSON.stringify([{ name: "external", color: "red", createdAt: 9 }]),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    });
    // Cache unchanged — still the seeded "work" label.
    expect(result.current.labels.map((l) => l.name)).toEqual(["work"]);
  });

  it("syncs from a cross-tab storage event", async () => {
    const useLabels = await importUseLabels();
    const { result } = renderHook(() => useLabels());
    const next: Label[] = [{ name: "external", color: "purple", createdAt: 5 }];
    act(() => {
      localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(
        new StorageEvent("storage", { key: LABELS_STORAGE_KEY }),
      );
    });
    expect(result.current.labels).toEqual(next);
  });
});
