import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  allLabels,
  createTodo,
  dedupeLabels,
  filterTodos,
  labelCounts,
  loadTodos,
  normalizeLabel,
  saveTodos,
  sortTodos,
  type StatusFilter,
  type Todo,
} from "./todos";
import { makeTodo, resetFactoryCounters } from "@/test-utils/factories";

beforeEach(() => {
  resetFactoryCounters();
});

describe("normalizeLabel", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeLabel("  hello  ")).toBe("hello");
  });
  it("collapses internal whitespace to a single space", () => {
    expect(normalizeLabel("foo   bar\t\tbaz")).toBe("foo bar baz");
  });
  it("preserves casing", () => {
    expect(normalizeLabel("FooBar")).toBe("FooBar");
  });
  it("returns empty string for whitespace-only input", () => {
    expect(normalizeLabel("   ")).toBe("");
  });
});

describe("dedupeLabels", () => {
  it("removes empty / whitespace-only entries", () => {
    expect(dedupeLabels(["foo", "", "   ", "bar"])).toEqual(["foo", "bar"]);
  });
  it("dedupes case-insensitively but preserves first occurrence casing", () => {
    expect(dedupeLabels(["Foo", "foo", "FOO", "bar"])).toEqual(["Foo", "bar"]);
  });
  it("collapses whitespace then dedupes", () => {
    expect(dedupeLabels(["foo  bar", "Foo Bar", " foo bar "])).toEqual([
      "foo bar",
    ]);
  });
  it("returns empty array for empty input", () => {
    expect(dedupeLabels([])).toEqual([]);
  });
});

describe("createTodo", () => {
  it("trims title and normalizes labels", () => {
    const t = createTodo({ title: "  Buy milk  ", labels: ["Foo", "foo"] });
    expect(t.title).toBe("Buy milk");
    expect(t.labels).toEqual(["Foo"]);
  });
  it("assigns a unique id and same timestamps for createdAt/updatedAt", () => {
    const t = createTodo({ title: "X" });
    expect(t.id).toBeTypeOf("string");
    expect(t.id.length).toBeGreaterThan(0);
    expect(t.createdAt).toBe(t.updatedAt);
    expect(t.completed).toBe(false);
  });
  it("strips empty description/dueDate to undefined", () => {
    const t = createTodo({
      title: "X",
      description: "   ",
      dueDate: "",
    });
    expect(t.description).toBeUndefined();
    expect(t.dueDate).toBeUndefined();
  });
  it("preserves non-empty description/dueDate (trimmed)", () => {
    const t = createTodo({
      title: "X",
      description: "  notes  ",
      dueDate: "2026-05-20",
    });
    expect(t.description).toBe("notes");
    expect(t.dueDate).toBe("2026-05-20");
  });
  it("defaults labels to empty array when omitted", () => {
    const t = createTodo({ title: "X" });
    expect(t.labels).toEqual([]);
  });
  it("falls back to a non-uuid id when crypto.randomUUID is missing", () => {
    const original = globalThis.crypto;
    // Simulate environment without randomUUID
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {},
    });
    try {
      const t = createTodo({ title: "X" });
      expect(t.id).toMatch(/^\d+-[a-z0-9]+$/);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: original,
      });
    }
  });
});

describe("sortTodos", () => {
  const a = makeTodo({ title: "Alpha", createdAt: 100 });
  const b = makeTodo({ title: "Beta", createdAt: 200 });
  const c = makeTodo({
    title: "Gamma",
    createdAt: 300,
    completed: true,
  });
  const list = [a, b, c];

  it("createdDesc orders newest first", () => {
    expect(sortTodos(list, "createdDesc").map((t) => t.title)).toEqual([
      "Gamma",
      "Beta",
      "Alpha",
    ]);
  });
  it("createdAsc orders oldest first", () => {
    expect(sortTodos(list, "createdAsc").map((t) => t.title)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
  });
  it("titleAsc orders alphabetically", () => {
    expect(
      sortTodos([c, a, b], "titleAsc").map((t) => t.title),
    ).toEqual(["Alpha", "Beta", "Gamma"]);
  });
  it("completed orders open before done; ties broken by createdDesc", () => {
    const t1 = makeTodo({ title: "open-old", completed: false, createdAt: 100 });
    const t2 = makeTodo({ title: "done-new", completed: true, createdAt: 300 });
    const t3 = makeTodo({ title: "open-new", completed: false, createdAt: 200 });
    expect(sortTodos([t2, t1, t3], "completed").map((t) => t.title)).toEqual([
      "open-new",
      "open-old",
      "done-new",
    ]);
  });
  it("dueDate sorts by ISO string ascending; missing due dates go to end", () => {
    const due1 = makeTodo({ title: "due-soon", dueDate: "2026-05-01" });
    const due2 = makeTodo({ title: "due-later", dueDate: "2026-06-01" });
    const noDue1 = makeTodo({ title: "no-due-1", createdAt: 100 });
    const noDue2 = makeTodo({ title: "no-due-2", createdAt: 200 });
    expect(
      sortTodos([noDue1, due2, noDue2, due1], "dueDate").map((t) => t.title),
    ).toEqual(["due-soon", "due-later", "no-due-2", "no-due-1"]);
  });
  it("does not mutate the input array", () => {
    const original = [...list];
    sortTodos(list, "titleAsc");
    expect(list).toEqual(original);
  });
});

describe("filterTodos", () => {
  const open1 = makeTodo({
    title: "Buy milk",
    labels: ["errands", "groceries"],
  });
  const open2 = makeTodo({
    title: "Read chapter 4",
    description: "Highlight quotes",
    labels: ["books"],
  });
  const done1 = makeTodo({
    title: "Call insurance",
    completed: true,
    labels: ["admin"],
  });

  it("returns all todos when filters are empty", () => {
    expect(filterTodos([open1, open2, done1], [], "")).toEqual([
      open1,
      open2,
      done1,
    ]);
  });

  describe("status filter", () => {
    const set = (...s: StatusFilter[]) => new Set<StatusFilter>(s);
    it("empty Set shows everything", () => {
      expect(
        filterTodos([open1, done1], [], "", set()).length,
      ).toBe(2);
    });
    it("both statuses shows everything", () => {
      expect(
        filterTodos([open1, done1], [], "", set("open", "done")).length,
      ).toBe(2);
    });
    it("open-only hides completed todos", () => {
      expect(
        filterTodos([open1, done1], [], "", set("open")),
      ).toEqual([open1]);
    });
    it("done-only shows only completed todos", () => {
      expect(
        filterTodos([open1, done1], [], "", set("done")),
      ).toEqual([done1]);
    });
  });

  describe("query filter", () => {
    it("matches title case-insensitively", () => {
      expect(filterTodos([open1, open2], [], "MILK")).toEqual([open1]);
    });
    it("matches description", () => {
      expect(filterTodos([open1, open2], [], "highlight")).toEqual([open2]);
    });
    it("trims surrounding whitespace in the query", () => {
      expect(filterTodos([open1, open2], [], "  milk  ")).toEqual([open1]);
    });
    it("empty query matches everything", () => {
      expect(filterTodos([open1, open2], [], "").length).toBe(2);
    });
  });

  describe("label filter", () => {
    it("OR-matches a single label", () => {
      expect(filterTodos([open1, open2], ["errands"], "")).toEqual([open1]);
    });
    it("OR-matches multiple labels (todo with ANY of them passes)", () => {
      expect(
        filterTodos([open1, open2], ["errands", "books"], ""),
      ).toEqual([open1, open2]);
    });
    it("is case-insensitive on both sides", () => {
      const t = makeTodo({ labels: ["Work"] });
      expect(filterTodos([t], ["work"], "")).toEqual([t]);
    });
    it("empty activeLabels disables the label filter", () => {
      expect(filterTodos([open1, open2], [], "").length).toBe(2);
    });
  });

  it("combines status + query + label as AND across filter types", () => {
    const set = (...s: StatusFilter[]) => new Set<StatusFilter>(s);
    const result = filterTodos(
      [open1, open2, done1],
      ["errands"],
      "milk",
      set("open"),
    );
    expect(result).toEqual([open1]);
  });
});

describe("allLabels", () => {
  it("collects unique labels across todos, sorted", () => {
    const todos = [
      makeTodo({ labels: ["work", "errands"] }),
      makeTodo({ labels: ["errands", "home"] }),
    ];
    expect(allLabels(todos)).toEqual(["errands", "home", "work"]);
  });
  it("returns empty array when no todos", () => {
    expect(allLabels([])).toEqual([]);
  });
});

describe("labelCounts", () => {
  it("counts only open (non-completed) todos", () => {
    const todos = [
      makeTodo({ labels: ["a"] }),
      makeTodo({ labels: ["a", "b"] }),
      makeTodo({ labels: ["a"], completed: true }),
    ];
    const counts = labelCounts(todos);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
  });
  it("returns empty map for no todos", () => {
    expect(labelCounts([]).size).toBe(0);
  });
});

describe("loadTodos / saveTodos", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips a list of todos", () => {
    const todos = [makeTodo(), makeTodo({ completed: true })];
    saveTodos(todos);
    expect(loadTodos()).toEqual(todos);
  });
  it("returns empty array when storage is unset", () => {
    expect(loadTodos()).toEqual([]);
  });
  it("returns empty array on malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    expect(loadTodos()).toEqual([]);
  });
  it("returns empty array when stored value isn't an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "array" }));
    expect(loadTodos()).toEqual([]);
  });
  it("filters out malformed entries while keeping valid ones", () => {
    const good = makeTodo();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([good, null, { id: "no-rest" }, "string"]),
    );
    expect(loadTodos()).toEqual([good]);
  });
  it("rejects entries with non-string description or dueDate", () => {
    const bad = {
      ...makeTodo(),
      description: 42 as unknown,
    } as Todo;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([bad]));
    expect(loadTodos()).toEqual([]);
  });

  // SSR / non-browser environments: loadTodos and saveTodos must be safe to
  // call. Simulate by deleting window temporarily.
  it("returns empty array when window is undefined", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simulating SSR
    delete globalThis.window;
    try {
      expect(loadTodos()).toEqual([]);
    } finally {
      globalThis.window = originalWindow;
    }
  });
  it("no-ops saveTodos when window is undefined", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    const originalWindow = globalThis.window;
    // @ts-expect-error simulating SSR
    delete globalThis.window;
    try {
      saveTodos([makeTodo()]);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      globalThis.window = originalWindow;
      spy.mockRestore();
    }
  });
});
