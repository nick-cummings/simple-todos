import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEY, type Todo } from "./todos";

// Each test re-imports useTodos via dynamic import so vi.resetModules()
// resets the module-scoped `cache` / `listeners`. Without this, state
// bleeds between tests because useTodos keeps cache at module scope.
async function importUseTodos() {
  vi.resetModules();
  const mod = await import("./useTodos");
  return mod.useTodos;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useTodos", () => {
  it("hydrates to empty when localStorage is empty", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    expect(result.current.todos).toEqual([]);
    await waitFor(() => expect(result.current.hydrated).toBe(true));
  });

  it("reads existing todos from localStorage on mount", async () => {
    const seeded: Todo[] = [
      {
        completed: false,
        createdAt: 100,
        id: "1",
        labels: [],
        title: "Buy milk",
        updatedAt: 100,
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    expect(result.current.todos).toEqual(seeded);
  });

  it("add() prepends a new todo and persists", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.add({ title: "Hello" });
    });
    expect(result.current.todos[0].title).toBe("Hello");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")[0].title).toBe(
      "Hello",
    );
  });

  it("add() ignores empty/whitespace titles", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.add({ title: "   " });
    });
    expect(result.current.todos).toEqual([]);
  });

  it("update() patches fields and dedupes labels", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.add({ title: "X" });
    });
    const id = result.current.todos[0].id;
    act(() => {
      result.current.update(id, {
        labels: ["Foo", "foo", "bar"],
        title: "X2",
      });
    });
    expect(result.current.todos[0].title).toBe("X2");
    expect(result.current.todos[0].labels).toEqual(["Foo", "bar"]);
  });

  it("update() preserves existing labels when patch.labels is undefined", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.add({ labels: ["a", "b"], title: "X" });
    });
    const id = result.current.todos[0].id;
    act(() => {
      result.current.update(id, { title: "X2" });
    });
    expect(result.current.todos[0].labels).toEqual(["a", "b"]);
  });

  it("toggle() flips completed and updates updatedAt", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.add({ title: "X" });
    });
    const id = result.current.todos[0].id;
    const beforeUpdated = result.current.todos[0].updatedAt;
    // Wait a tick so updatedAt necessarily differs.
    await new Promise((r) => setTimeout(r, 2));
    act(() => {
      result.current.toggle(id);
    });
    expect(result.current.todos[0].completed).toBe(true);
    expect(result.current.todos[0].updatedAt).toBeGreaterThanOrEqual(
      beforeUpdated,
    );
  });

  it("remove() drops the todo", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.add({ title: "X" });
    });
    const id = result.current.todos[0].id;
    act(() => {
      result.current.remove(id);
    });
    expect(result.current.todos).toEqual([]);
  });

  it("restore() puts a removed todo back verbatim", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.add({ labels: ["shopping"], title: "Buy milk" });
    });
    const original = result.current.todos[0];
    act(() => {
      result.current.remove(original.id);
    });
    expect(result.current.todos).toEqual([]);
    act(() => {
      result.current.restore(original);
    });
    expect(result.current.todos).toEqual([original]);
    // Same id and createdAt — not a fresh todo.
    expect(result.current.todos[0].id).toBe(original.id);
    expect(result.current.todos[0].createdAt).toBe(original.createdAt);
  });

  it("restore() is a no-op when the todo's id already exists", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.add({ title: "Buy milk" });
    });
    const original = result.current.todos[0];
    act(() => {
      result.current.restore(original);
    });
    expect(result.current.todos).toHaveLength(1);
  });

  it("clearCompleted() removes only completed todos", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.add({ title: "Keep" });
      result.current.add({ title: "Drop" });
    });
    // add() prepends, so [0] = "Drop", [1] = "Keep"
    const keepId = result.current.todos[1].id;
    const dropId = result.current.todos[0].id;
    act(() => {
      result.current.toggle(dropId);
    });
    act(() => {
      result.current.clearCompleted();
    });
    expect(result.current.todos.map((t) => t.id)).toEqual([keepId]);
  });

  it("ignores storage events for unrelated keys", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    const next: Todo[] = [
      {
        completed: false,
        createdAt: 1,
        id: "9",
        labels: [],
        title: "Should be ignored",
        updatedAt: 1,
      },
    ];
    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // Different key — should NOT cause a re-read.
      globalThis.dispatchEvent(
        new StorageEvent("storage", { key: "some-other-key" }),
      );
    });
    expect(result.current.todos).toEqual([]);
  });

  it("syncs from a cross-tab storage event", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    const next: Todo[] = [
      {
        completed: false,
        createdAt: 999,
        id: "9",
        labels: [],
        title: "External",
        updatedAt: 999,
      },
    ];
    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      globalThis.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY }),
      );
    });
    expect(result.current.todos).toEqual(next);
  });
});
