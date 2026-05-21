import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeTodo, resetFactoryCounters } from "@/test-utils/factories";

import {
  allLabels,
  createTodo,
  dedupeLabels,
  filterTodos,
  labelCounts,
  loadTodos,
  nextOccurrence,
  normalizeLabel,
  recurrenceLabel,
  saveTodos,
  sortTodos,
  type StatusFilter,
  STORAGE_KEY,
  type Todo,
} from "./todos";

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
    const t = createTodo({ labels: ["Foo", "foo"], title: "  Buy milk  " });
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
      description: "   ",
      dueDate: "",
      title: "X",
    });
    expect(t.description).toBeUndefined();
    expect(t.dueDate).toBeUndefined();
  });
  it("preserves non-empty description/dueDate (trimmed)", () => {
    const t = createTodo({
      description: "  notes  ",
      dueDate: "2026-05-20",
      title: "X",
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
  const a = makeTodo({ createdAt: 100, title: "Alpha" });
  const b = makeTodo({ createdAt: 200, title: "Beta" });
  const c = makeTodo({
    completed: true,
    createdAt: 300,
    title: "Gamma",
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
    expect(sortTodos([c, a, b], "titleAsc").map((t) => t.title)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
  });
  it("completed orders open before done; ties broken by createdDesc", () => {
    const t1 = makeTodo({
      completed: false,
      createdAt: 100,
      title: "open-old",
    });
    const t2 = makeTodo({ completed: true, createdAt: 300, title: "done-new" });
    const t3 = makeTodo({
      completed: false,
      createdAt: 200,
      title: "open-new",
    });
    expect(sortTodos([t2, t1, t3], "completed").map((t) => t.title)).toEqual([
      "open-new",
      "open-old",
      "done-new",
    ]);
  });
  it("dueDate sorts by ISO string ascending; missing due dates go to end", () => {
    const due1 = makeTodo({ dueDate: "2026-05-01", title: "due-soon" });
    const due2 = makeTodo({ dueDate: "2026-06-01", title: "due-later" });
    const noDue1 = makeTodo({ createdAt: 100, title: "no-due-1" });
    const noDue2 = makeTodo({ createdAt: 200, title: "no-due-2" });
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
    labels: ["errands", "groceries"],
    title: "Buy milk",
  });
  const open2 = makeTodo({
    description: "Highlight quotes",
    labels: ["books"],
    title: "Read chapter 4",
  });
  const done1 = makeTodo({
    completed: true,
    labels: ["admin"],
    title: "Call insurance",
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
      expect(filterTodos([open1, done1], [], "", set()).length).toBe(2);
    });
    it("both statuses shows everything", () => {
      expect(
        filterTodos([open1, done1], [], "", set("open", "done")).length,
      ).toBe(2);
    });
    it("open-only hides completed todos", () => {
      expect(filterTodos([open1, done1], [], "", set("open"))).toEqual([open1]);
    });
    it("done-only shows only completed todos", () => {
      expect(filterTodos([open1, done1], [], "", set("done"))).toEqual([done1]);
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
      expect(filterTodos([open1, open2], ["errands", "books"], "")).toEqual([
        open1,
        open2,
      ]);
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
      makeTodo({ completed: true, labels: ["a"] }),
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

describe("nextOccurrence", () => {
  it("advances by N days", () => {
    expect(nextOccurrence("2026-05-20", { every: 1, unit: "day" })).toBe(
      "2026-05-21",
    );
    expect(nextOccurrence("2026-05-20", { every: 10, unit: "day" })).toBe(
      "2026-05-30",
    );
  });
  it("advances by N weeks", () => {
    expect(nextOccurrence("2026-05-20", { every: 1, unit: "week" })).toBe(
      "2026-05-27",
    );
    expect(nextOccurrence("2026-05-20", { every: 2, unit: "week" })).toBe(
      "2026-06-03",
    );
  });
  it("advances by N months and rolls year correctly", () => {
    expect(nextOccurrence("2026-05-20", { every: 1, unit: "month" })).toBe(
      "2026-06-20",
    );
    expect(nextOccurrence("2026-11-20", { every: 2, unit: "month" })).toBe(
      "2027-01-20",
    );
  });
  it("returns the input unchanged when the date is malformed", () => {
    expect(nextOccurrence("not-a-date", { every: 1, unit: "day" })).toBe(
      "not-a-date",
    );
  });
});

describe("recurrenceLabel", () => {
  it("collapses every-1 forms to bare adjective", () => {
    expect(recurrenceLabel({ every: 1, unit: "day" })).toBe("Daily");
    expect(recurrenceLabel({ every: 1, unit: "week" })).toBe("Weekly");
    expect(recurrenceLabel({ every: 1, unit: "month" })).toBe("Monthly");
  });
  it("formats every-N forms with plural units", () => {
    expect(recurrenceLabel({ every: 2, unit: "day" })).toBe("Every 2 days");
    expect(recurrenceLabel({ every: 3, unit: "week" })).toBe("Every 3 weeks");
    expect(recurrenceLabel({ every: 6, unit: "month" })).toBe("Every 6 months");
  });
});

describe("loadTodos (recurrence validation)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps todos whose recurrence shape is valid", () => {
    const raw: Todo[] = [
      {
        completed: false,
        createdAt: 1,
        id: "1",
        labels: [],
        recurrence: { every: 2, unit: "week" },
        title: "x",
        updatedAt: 1,
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    expect(loadTodos()).toEqual(raw);
  });

  it("rejects todos whose recurrence has a bad unit", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          completed: false,
          createdAt: 1,
          id: "1",
          labels: [],
          recurrence: { every: 1, unit: "year" },
          title: "x",
          updatedAt: 1,
        },
      ]),
    );
    expect(loadTodos()).toEqual([]);
  });

  it("rejects todos whose recurrence has every < 1", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          completed: false,
          createdAt: 1,
          id: "1",
          labels: [],
          recurrence: { every: 0, unit: "day" },
          title: "x",
          updatedAt: 1,
        },
      ]),
    );
    expect(loadTodos()).toEqual([]);
  });

  it("rejects todos whose recurrence isn't an object", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          completed: false,
          createdAt: 1,
          id: "1",
          labels: [],
          recurrence: "weekly",
          title: "x",
          updatedAt: 1,
        },
      ]),
    );
    expect(loadTodos()).toEqual([]);
  });
});

describe("createTodo (recurrence)", () => {
  it("accepts a valid recurrence", () => {
    const t = createTodo({
      recurrence: { every: 2, unit: "week" },
      title: "x",
    });
    expect(t.recurrence).toEqual({ every: 2, unit: "week" });
  });
  it("drops a recurrence with non-positive every", () => {
    const t = createTodo({
      recurrence: { every: 0, unit: "day" },
      title: "x",
    });
    expect(t.recurrence).toBeUndefined();
  });
  it("drops a recurrence with an unknown unit", () => {
    const t = createTodo({
      // @ts-expect-error testing runtime validation
      recurrence: { every: 1, unit: "year" },
      title: "x",
    });
    expect(t.recurrence).toBeUndefined();
  });
});
