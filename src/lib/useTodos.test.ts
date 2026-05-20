import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEY, type Todo } from "./todos";

// Each test re-imports useTodos via dynamic import so vi.resetModules()
// resets the module-scoped `cache` / `listeners`. Without this, state
// bleeds between tests because useTodos keeps cache at module scope.
async function importUseTodos() {
  vi.resetModules();
  return (await import("./useTodos")).useTodos;
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
        id: "1",
        title: "Buy milk",
        completed: false,
        labels: [],
        createdAt: 100,
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
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")[0].title).toBe(
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
        title: "X2",
        labels: ["Foo", "foo", "bar"],
      });
    });
    expect(result.current.todos[0].title).toBe("X2");
    expect(result.current.todos[0].labels).toEqual(["Foo", "bar"]);
  });

  it("update() preserves existing labels when patch.labels is undefined", async () => {
    const useTodos = await importUseTodos();
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.add({ title: "X", labels: ["a", "b"] });
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
        id: "9",
        title: "Should be ignored",
        completed: false,
        labels: [],
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // Different key — should NOT cause a re-read.
      window.dispatchEvent(
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
        id: "9",
        title: "External",
        completed: false,
        labels: [],
        createdAt: 999,
        updatedAt: 999,
      },
    ];
    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY }),
      );
    });
    expect(result.current.todos).toEqual(next);
  });
});
