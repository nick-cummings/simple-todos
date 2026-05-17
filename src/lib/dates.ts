const DAY_MS = 24 * 60 * 60 * 1000;

export function relativeTime(epochMs: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - epochMs);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / (60 * 60_000));
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / DAY_MS);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Number of days from today to a YYYY-MM-DD date (negative if past). */
export function daysFromToday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return Number.POSITIVE_INFINITY;
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / DAY_MS);
}

export function isOverdue(iso: string | undefined, completed: boolean): boolean {
  if (!iso || completed) return false;
  return daysFromToday(iso) < 0;
}

export function isDueSoon(iso: string | undefined): boolean {
  if (!iso) return false;
  const d = daysFromToday(iso);
  return d >= 0 && d <= 3;
}

export function formatDueDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function shortWeekday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" });
}

/** True if `epochMs` falls within the past 7 days. */
export function isCompletedThisWeek(epochMs: number, now: number = Date.now()): boolean {
  return now - epochMs <= 7 * DAY_MS;
}

export type Priority = "high" | "medium" | "low" | "none";

export function priorityOf(input: {
  dueDate?: string;
  completed: boolean;
}): Priority {
  if (!input.dueDate) return "none";
  if (input.completed) return "low";
  const d = daysFromToday(input.dueDate);
  if (d < 0) return "high";       // overdue
  if (d <= 3) return "medium";    // due soon
  return "low";                    // upcoming
}

export type DueGroup = "this-week" | "later";

export function dueGroupOf(input: { dueDate?: string }): DueGroup {
  if (!input.dueDate) return "later";
  const d = daysFromToday(input.dueDate);
  return d <= 7 ? "this-week" : "later";
}

export function groupByDue<T extends { dueDate?: string }>(
  items: T[],
): { key: DueGroup; label: string; items: T[] }[] {
  const week: T[] = [];
  const later: T[] = [];
  for (const t of items) {
    if (dueGroupOf(t) === "this-week") week.push(t);
    else later.push(t);
  }
  const out: { key: DueGroup; label: string; items: T[] }[] = [];
  if (week.length) out.push({ key: "this-week", label: "This week", items: week });
  if (later.length) out.push({ key: "later", label: "Later", items: later });
  return out;
}
