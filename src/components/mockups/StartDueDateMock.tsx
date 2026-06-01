"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Demonstrates the "Start vs due date" feature. A todo gains an
 * optional *start* date alongside its existing *due* date, so you can
 * say "this doesn't begin until Monday, and it's due Friday".
 *
 * Edit modal:
 *  - The single "Due date" row becomes a two-up "Starts / Due" pair.
 *    Both are optional and independent — you can set a start with no
 *    due date, a due date with no start, both, or neither.
 *  - A hint line clarifies that a future start date hides the todo's
 *    urgency until it begins (it reads as "Upcoming", not "Due").
 *
 * Card:
 *  - The date row under the title shows both ends when present:
 *    "Starts May 28 · Due Jun 4". When only one is set it collapses
 *    to that one.
 *  - State drives emphasis, not just text:
 *      • Upcoming  — start date is in the future. Muted; leads with
 *        "Starts <date>". The todo isn't actionable yet.
 *      • Active    — started (or no start) and not overdue. Neutral.
 *      • Overdue   — due date has passed. Due chip turns red.
 *
 * Data model addition: `startDate: string | null` on Todo, sitting
 * next to the existing `dueDate: string | null`. Both are ISO date
 * strings (no time component). Validation worth noting for the real
 * build: when both are set, `startDate <= dueDate` — the edit form
 * should flag an inverted range rather than silently accept it.
 */

import { useState } from "react";

type CardState = "active" | "overdue" | "upcoming";

const CARDS: {
  title: string;
  start: string | null;
  due: string | null;
  state: CardState;
}[] = [
  {
    title: "Draft Q3 planning doc",
    start: "Jun 2",
    due: "Jun 9",
    state: "upcoming",
  },
  {
    title: "Review pull requests",
    start: "May 28",
    due: "Today",
    state: "active",
  },
  {
    title: "Book flights",
    start: null,
    due: "Jun 4",
    state: "active",
  },
  {
    title: "Submit expense report",
    start: "May 20",
    due: "May 27",
    state: "overdue",
  },
];

export default function StartDueDateMock() {
  // The edit pane previews the "Review pull requests" card.
  const [start, setStart] = useState("2026-05-28");
  const [due, setDue] = useState("2026-05-30");

  const inverted = start !== "" && due !== "" && start > due;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-5 pt-10 pb-32 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-5xl font-semibold leading-none tracking-[-0.045em]">
          todos
        </h1>
        <p className="text-[13px] text-muted">
          Mockup — start vs due dates. Cards show “starts / due”; the edit
          pane on the right grows a paired Starts / Due row.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,400px)]">
        {/* Left: list showing both date ends per card */}
        <ul className="flex flex-col gap-2.5">
          {CARDS.map((t) => (
            <li
              key={t.title}
              className="flex items-start gap-3.5 rounded-xl border border-line bg-card px-5 py-4 shadow-soft"
            >
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-[1.5px] border-line-emphasis" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className={
                    `text-[15px] font-medium ` +
                    (t.state === "upcoming" ? "text-muted" : "text-fg")
                  }
                >
                  {t.title}
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-faint">
                  {t.start && (
                    <span
                      className={
                        `inline-flex items-center gap-1 ` +
                        (t.state === "upcoming" ? "text-primary" : "")
                      }
                    >
                      <FlagIcon />
                      Starts {t.start}
                    </span>
                  )}
                  {t.due && (
                    <span
                      className={
                        `inline-flex items-center gap-1 ` +
                        (t.state === "overdue" ? "text-danger" : "")
                      }
                    >
                      <CalendarIcon />
                      Due {t.due}
                    </span>
                  )}
                  {t.state === "upcoming" && (
                    <span className="rounded-full bg-primary-bg px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                      Upcoming
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Right: edit pane with the paired Starts / Due row */}
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-pop">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
            Edit todo
          </h2>

          <Field label="Title">
            <input
              value="Review pull requests"
              readOnly
              className="h-11 rounded-lg border border-line-strong bg-card px-3 text-base"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts" optional>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-11 rounded-lg border border-line-strong bg-card px-3 text-sm"
              />
            </Field>
            <Field label="Due" optional>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="h-11 rounded-lg border border-line-strong bg-card px-3 text-sm"
              />
            </Field>
          </div>

          {inverted ? (
            <p className="text-[11px] font-medium text-danger">
              The start date is after the due date — pick a start on or
              before the due date.
            </p>
          ) : (
            <p className="text-[11px] text-faint">
              Both dates are optional. A start date in the future keeps the
              todo “Upcoming” — it won’t read as due until it begins.
            </p>
          )}
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

function FlagIcon() {
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
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
    </svg>
  );
}
