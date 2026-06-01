import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { parseQuickAdd } from "./QuickAddMock";

// Freeze the clock so relative date keywords resolve deterministically.
// 2026-05-20 is a Wednesday (getDay() === 3); local-noon avoids
// midnight/timezone edges.
const NOW = new Date(2026, 4, 20, 12, 0, 0);

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

describe("parseQuickAdd (mockup stub)", () => {
  it("treats a plain line as the title with no tokens", () => {
    expect(parseQuickAdd("Buy milk")).toEqual({
      dueDate: undefined,
      labels: [],
      priority: "none",
      title: "Buy milk",
    });
  });

  it("pulls date, label, and priority tokens and leaves the title clean", () => {
    expect(parseQuickAdd("Pay rent friday @bills !high")).toEqual({
      dueDate: "2026-05-22",
      labels: ["bills"],
      priority: "high",
      title: "Pay rent",
    });
  });

  it("resolves today and tomorrow relative to the frozen clock", () => {
    expect(parseQuickAdd("ship it today").dueDate).toBe("2026-05-20");
    expect(parseQuickAdd("ship it tomorrow").dueDate).toBe("2026-05-21");
  });

  it("resolves the same weekday name to next week, not today", () => {
    // NOW is Wednesday; "wednesday" should jump a full week ahead.
    expect(parseQuickAdd("standup wednesday").dueDate).toBe("2026-05-27");
  });

  it("collects multiple labels and dedupes case-insensitively", () => {
    const parsed = parseQuickAdd("plan @Work @home @work trip");
    expect(parsed.labels).toEqual(["work", "home"]);
    expect(parsed.title).toBe("plan trip");
  });

  it("keeps only the first recognized date keyword", () => {
    const parsed = parseQuickAdd("call today tomorrow");
    expect(parsed.dueDate).toBe("2026-05-20");
    // The unused keyword falls through to the title.
    expect(parsed.title).toBe("call tomorrow");
  });

  it("maps priority aliases and ignores unknown bang words", () => {
    expect(parseQuickAdd("task !urgent").priority).toBe("high");
    expect(parseQuickAdd("task !med").priority).toBe("medium");
    const unknown = parseQuickAdd("task !someday");
    expect(unknown.priority).toBe("none");
    expect(unknown.title).toBe("task !someday");
  });

  it("ignores bare @ and ! markers with no word", () => {
    const parsed = parseQuickAdd("email @ boss ! now");
    expect(parsed.labels).toEqual([]);
    expect(parsed.priority).toBe("none");
    expect(parsed.title).toBe("email @ boss ! now");
  });

  it("returns an empty title when the line is only tokens", () => {
    const parsed = parseQuickAdd("tomorrow @home !low");
    expect(parsed.title).toBe("");
    expect(parsed.dueDate).toBe("2026-05-21");
    expect(parsed.labels).toEqual(["home"]);
    expect(parsed.priority).toBe("low");
  });
});
