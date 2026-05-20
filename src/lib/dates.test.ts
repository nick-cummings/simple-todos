import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  daysFromToday,
  dueGroupOf,
  formatDueDate,
  groupByDue,
  isCompletedThisWeek,
  isDueSoon,
  isOverdue,
  priorityOf,
  relativeTime,
  shortWeekday,
  todayISO,
  toISODate,
} from "./dates";

// Freeze the clock so date math is deterministic across time zones.
// Using local-noon to avoid any wall-clock-vs-local-midnight edge cases.
const NOW = new Date(2026, 4, 20, 12, 0, 0); // 2026-05-20 12:00 local

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

describe("relativeTime", () => {
  const now = NOW.getTime();
  it.each([
    [now, "just now"],
    [now - 30_000, "just now"],
    [now - 5 * 60_000, "5m ago"],
    [now - 59 * 60_000, "59m ago"],
    [now - 60 * 60_000, "1h ago"],
    [now - 23 * 60 * 60_000, "23h ago"],
    [now - 24 * 60 * 60_000, "1d ago"],
    [now - 6 * 24 * 60 * 60_000, "6d ago"],
    [now - 14 * 24 * 60 * 60_000, "2w ago"],
    [now - 40 * 24 * 60 * 60_000, "1mo ago"],
    [now - 400 * 24 * 60 * 60_000, "1y ago"],
  ])("for delta %i -> %s", (epoch, expected) => {
    expect(relativeTime(epoch, now)).toBe(expected);
  });
  it("clamps future times to 'just now'", () => {
    expect(relativeTime(now + 5_000, now)).toBe("just now");
  });
});

describe("toISODate / todayISO", () => {
  it("formats a Date as YYYY-MM-DD with zero-padded month and day", () => {
    expect(toISODate(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
  it("todayISO returns today in YYYY-MM-DD form", () => {
    expect(todayISO()).toBe("2026-05-20");
  });
});

describe("daysFromToday", () => {
  it("returns 0 for today", () => {
    expect(daysFromToday("2026-05-20")).toBe(0);
  });
  it("returns positive for future, negative for past", () => {
    expect(daysFromToday("2026-05-25")).toBe(5);
    expect(daysFromToday("2026-05-15")).toBe(-5);
  });
  it("returns Infinity for malformed input", () => {
    expect(daysFromToday("not-a-date")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("isOverdue", () => {
  it("is true for past due, uncompleted", () => {
    expect(isOverdue("2026-05-19", false)).toBe(true);
  });
  it("is false for past due but completed", () => {
    expect(isOverdue("2026-05-19", true)).toBe(false);
  });
  it("is false for today (boundary)", () => {
    expect(isOverdue("2026-05-20", false)).toBe(false);
  });
  it("is false for future", () => {
    expect(isOverdue("2026-05-21", false)).toBe(false);
  });
  it("is false for undefined dueDate", () => {
    expect(isOverdue(undefined, false)).toBe(false);
  });
});

describe("isDueSoon", () => {
  it("is true for today through +3 days", () => {
    expect(isDueSoon("2026-05-20")).toBe(true);
    expect(isDueSoon("2026-05-23")).toBe(true);
  });
  it("is false for +4 days or later", () => {
    expect(isDueSoon("2026-05-24")).toBe(false);
  });
  it("is false for past", () => {
    expect(isDueSoon("2026-05-19")).toBe(false);
  });
  it("is false for undefined", () => {
    expect(isDueSoon(undefined)).toBe(false);
  });
});

describe("formatDueDate / shortWeekday", () => {
  it("formatDueDate returns a readable date string", () => {
    // Wed, May 20
    expect(formatDueDate("2026-05-20")).toMatch(/Wed|May|20/);
  });
  it("formatDueDate returns the input verbatim on malformed input", () => {
    expect(formatDueDate("not-a-date")).toBe("not-a-date");
  });
  it("shortWeekday returns a short weekday name", () => {
    expect(shortWeekday("2026-05-20")).toMatch(/Wed/);
  });
  it("shortWeekday returns the input verbatim on malformed input", () => {
    expect(shortWeekday("nope")).toBe("nope");
  });
});

describe("isCompletedThisWeek", () => {
  const now = NOW.getTime();
  const DAY = 24 * 60 * 60 * 1000;
  it("is true within the past 7 days", () => {
    expect(isCompletedThisWeek(now - 3 * DAY, now)).toBe(true);
    expect(isCompletedThisWeek(now - 7 * DAY, now)).toBe(true);
  });
  it("is false beyond 7 days", () => {
    expect(isCompletedThisWeek(now - 8 * DAY, now)).toBe(false);
  });
});

describe("priorityOf", () => {
  it("none when no due date", () => {
    expect(priorityOf({ completed: false })).toBe("none");
  });
  it("low when completed (regardless of due date)", () => {
    expect(priorityOf({ dueDate: "2026-05-15", completed: true })).toBe("low");
  });
  it("high when overdue and not completed", () => {
    expect(priorityOf({ dueDate: "2026-05-19", completed: false })).toBe("high");
  });
  it("medium when due within 3 days", () => {
    expect(priorityOf({ dueDate: "2026-05-22", completed: false })).toBe(
      "medium",
    );
  });
  it("low when due later than 3 days out", () => {
    expect(priorityOf({ dueDate: "2026-06-01", completed: false })).toBe("low");
  });
});

describe("dueGroupOf / groupByDue", () => {
  it("dueGroupOf 'this-week' when within 7 days", () => {
    expect(dueGroupOf({ dueDate: "2026-05-25" })).toBe("this-week");
  });
  it("dueGroupOf 'later' when more than 7 days out", () => {
    expect(dueGroupOf({ dueDate: "2026-06-01" })).toBe("later");
  });
  it("dueGroupOf 'later' when no due date", () => {
    expect(dueGroupOf({})).toBe("later");
  });
  it("groupByDue splits items and labels them", () => {
    const items = [
      { id: "a", dueDate: "2026-05-22" },
      { id: "b", dueDate: "2026-06-01" },
      { id: "c" },
    ];
    const groups = groupByDue(items);
    expect(groups).toEqual([
      { key: "this-week", label: "This week", items: [items[0]] },
      { key: "later", label: "Later", items: [items[1], items[2]] },
    ]);
  });
  it("groupByDue omits empty groups", () => {
    expect(groupByDue([{ id: "a", dueDate: "2026-05-22" }])).toEqual([
      { key: "this-week", label: "This week", items: [{ id: "a", dueDate: "2026-05-22" }] },
    ]);
  });
});
