"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Demonstrates recurring tasks. The edit modal grows a "Repeat" row
 * with quick presets (Never, Daily, Weekly, Monthly) and a Custom…
 * affordance for "every N days/weeks/months". Completed recurring
 * todos respawn with the next due date instead of going to "Done".
 *
 * Notes:
 *  - The recurrence chip sits next to the due-date row so it's
 *    discoverable but not pushed above the fold for non-repeating
 *    todos.
 *  - Card badge: a 🔁 + cadence label appears under the title so
 *    you can see at a glance which todos repeat.
 *  - Custom picker is a separate sheet (preview shown here as an
 *    inline disclosure).
 *  - Data model addition: `recurrence: { every: number; unit: "day"
 *    | "week" | "month" } | null` on Todo. Completion handler:
 *    if recurrence is set, schedule the next dueDate and re-open
 *    the todo instead of marking it done.
 */

import { useState } from "react";

type Preset = "custom" | "daily" | "monthly" | "never" | "weekly";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom…" },
];

const CARDS = [
  { title: "Water the plants", repeat: "daily" as const, due: "Today" },
  {
    title: "Take out trash",
    repeat: "weekly" as const,
    due: "Tomorrow · Wed",
  },
  { title: "Pay rent", repeat: "monthly" as const, due: "May 31" },
  { title: "Renew passport", repeat: null, due: "Sep 4" },
];

const REPEAT_LABEL: Record<"daily" | "monthly" | "weekly", string> = {
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
};

export default function RecurringTaskMock() {
  const [selected, setSelected] = useState<Preset>("weekly");
  const [customN, setCustomN] = useState(2);
  const [customUnit, setCustomUnit] = useState<"day" | "month" | "week">(
    "week",
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-5 pt-10 pb-32 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-5xl font-semibold leading-none tracking-[-0.045em]">
          todos
        </h1>
        <p className="text-[13px] text-muted">
          Mockup — recurring tasks. Edit pane on the right shows the new
          Repeat field.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,400px)]">
        {/* Left: list with recurrence badges */}
        <ul className="flex flex-col gap-2.5">
          {CARDS.map((t) => (
            <li
              key={t.title}
              className="flex items-start gap-3.5 rounded-xl border border-line bg-card px-5 py-4 shadow-soft"
            >
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-[1.5px] border-line-emphasis" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[15px] font-medium text-fg">
                  {t.title}
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-faint">
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon />
                    {t.due}
                  </span>
                  {t.repeat && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <RepeatIcon />
                      {REPEAT_LABEL[t.repeat]}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Right: open edit pane showing the new Repeat row */}
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-pop">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
              Edit todo
            </h2>
          </div>

          <Field label="Title">
            <input
              value="Take out trash"
              readOnly
              className="h-11 rounded-lg border border-line-strong bg-card px-3 text-base"
            />
          </Field>

          <Field label="Due date" optional>
            <input
              type="date"
              value="2026-05-21"
              readOnly
              className="h-11 rounded-lg border border-line-strong bg-card px-3 text-sm"
            />
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted">
              Repeat <span className="text-faint">(optional)</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => {
                const active = selected === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setSelected(p.value)}
                    aria-pressed={active}
                    className={
                      `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ` +
                      (active
                        ? "border-primary-border bg-primary-bg text-primary"
                        : "border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg")
                    }
                  >
                    {p.value !== "never" && p.value !== "custom" && (
                      <RepeatIcon />
                    )}
                    {p.label}
                  </button>
                );
              })}
            </div>

            {selected === "custom" && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-subtle p-3 text-[13px]">
                <span className="text-muted">Every</span>
                <input
                  type="number"
                  min={1}
                  value={customN}
                  onChange={(e) => setCustomN(Number(e.target.value))}
                  className="h-9 w-16 rounded-md border border-line-strong bg-card px-2 text-center font-medium"
                />
                <select
                  value={customUnit}
                  onChange={(e) =>
                    setCustomUnit(e.target.value as typeof customUnit)
                  }
                  className="h-9 rounded-md border border-line-strong bg-card px-2 font-medium"
                >
                  <option value="day">days</option>
                  <option value="week">weeks</option>
                  <option value="month">months</option>
                </select>
              </div>
            )}

            <p className="text-[11px] text-faint">
              When you complete a repeating todo, it respawns with the next
              due date instead of moving to Done.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  children,
  label,
  optional,
}: {
  children: React.ReactNode;
  label: string;
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">
        {label}
        {optional && <span className="text-faint"> (optional)</span>}
      </span>
      {children}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
