"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Demonstrates the proposed Agenda views feature: two date-oriented
 * ways to look at the same todos, toggled by a segmented control.
 *
 *  - Today: everything due today plus anything overdue, with overdue
 *    items called out so they don't hide below the fold.
 *  - Upcoming: a forward-looking agenda grouped by day (Tomorrow, then
 *    each subsequent date), so you can see the shape of the week.
 *
 * Notes:
 *  - This is a static mockup. Dates are hard-coded relative to the
 *    fictional "today" so the layout reads the same on any run; no real
 *    todos are read and nothing is persisted.
 *  - Reuses the app's card/token visual language (bg-card, text-muted,
 *    border-line, etc.) so the prototype reads as the real surface.
 *  - Both views share the same row renderer so a real implementation
 *    can lift one `<AgendaRow>` and feed it grouped todos.
 *  - Data model: no new fields. Grouping keys off the existing
 *    `dueDate` (ISO YYYY-MM-DD); "overdue" is `dueDate < today`.
 */

import { useState } from "react";

type View = "today" | "upcoming";

interface MockTodo {
  title: string;
  label?: string;
  time?: string;
  overdue?: boolean;
}

const TODAY: MockTodo[] = [
  { title: "Renew passport", label: "admin", overdue: true },
  { title: "Reply to landlord about lease", label: "home", overdue: true },
  { title: "Stand-up notes for the team", label: "work", time: "9:30 AM" },
  { title: "Water the plants", label: "home" },
  { title: "Submit expense report", label: "work", time: "5:00 PM" },
];

interface DayGroup {
  key: string;
  heading: string;
  sub: string;
  todos: MockTodo[];
}

const UPCOMING: DayGroup[] = [
  {
    key: "tomorrow",
    heading: "Tomorrow",
    sub: "Mon · Jun 1",
    todos: [
      { title: "Dentist appointment", label: "health", time: "11:00 AM" },
      { title: "Pay rent", label: "home" },
    ],
  },
  {
    key: "tue",
    heading: "Tuesday",
    sub: "Jun 2",
    todos: [{ title: "Team retro", label: "work", time: "2:00 PM" }],
  },
  {
    key: "wed",
    heading: "Wednesday",
    sub: "Jun 3",
    todos: [
      { title: "Take out trash", label: "home" },
      { title: "Call mom", label: "personal" },
      { title: "Renew library books", label: "admin" },
    ],
  },
  {
    key: "fri",
    heading: "Friday",
    sub: "Jun 5",
    todos: [{ title: "Flight to Lisbon", label: "travel", time: "6:40 AM" }],
  },
];

export default function AgendaViewsMock() {
  const [view, setView] = useState<View>("today");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-7 px-5 pt-10 pb-32 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-5xl font-semibold leading-none tracking-[-0.045em]">
          todos
        </h1>
        <p className="text-[13px] text-muted">
          Mockup — agenda views. Switch between Today and an Upcoming
          agenda grouped by day.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Agenda view"
        className="flex gap-1 rounded-full border border-line bg-subtle p-1"
      >
        <ViewTab
          active={view === "today"}
          label="Today"
          onClick={() => setView("today")}
        />
        <ViewTab
          active={view === "upcoming"}
          label="Upcoming"
          onClick={() => setView("upcoming")}
        />
      </div>

      {view === "today" ? <TodayView /> : <UpcomingView />}
    </main>
  );
}

function TodayView() {
  const overdue = TODAY.filter((t) => t.overdue);
  const dueToday = TODAY.filter((t) => !t.overdue);

  return (
    <section className="flex flex-col gap-6" aria-label="Today">
      <DayHeading heading="Today" sub="Sunday · May 31" count={TODAY.length} />

      {overdue.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-danger">
            <AlertIcon />
            Overdue
            <span className="text-faint">({overdue.length})</span>
          </h3>
          <ul className="flex flex-col gap-2.5">
            {overdue.map((t) => (
              <AgendaRow key={t.title} todo={t} />
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
          Due today
          <span className="ml-1.5 font-medium normal-case tracking-normal text-faint">
            ({dueToday.length})
          </span>
        </h3>
        <ul className="flex flex-col gap-2.5">
          {dueToday.map((t) => (
            <AgendaRow key={t.title} todo={t} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function UpcomingView() {
  return (
    <section className="flex flex-col gap-6" aria-label="Upcoming">
      {UPCOMING.map((group) => (
        <div key={group.key} className="flex flex-col gap-2.5">
          <DayHeading
            heading={group.heading}
            sub={group.sub}
            count={group.todos.length}
          />
          <ul className="flex flex-col gap-2.5">
            {group.todos.map((t) => (
              <AgendaRow key={t.title} todo={t} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function DayHeading({
  heading,
  sub,
  count,
}: {
  heading: string;
  sub: string;
  count: number;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-line pb-1.5">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-fg">
          {heading}
        </h2>
        <span className="text-[12px] font-medium text-faint">{sub}</span>
      </div>
      <span className="text-[12px] font-medium text-faint">
        {count} {count === 1 ? "item" : "items"}
      </span>
    </div>
  );
}

function AgendaRow({ todo }: { todo: MockTodo }) {
  return (
    <li className="flex items-start gap-3.5 rounded-xl border border-line bg-card px-5 py-3.5 shadow-soft">
      <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-[1.5px] border-line-emphasis" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] font-medium text-fg">{todo.title}</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-faint">
          {todo.time && (
            <span className="inline-flex items-center gap-1">
              <ClockIcon />
              {todo.time}
            </span>
          )}
          {todo.overdue && (
            <span className="inline-flex items-center gap-1 text-danger">
              <AlertIcon />
              Overdue
            </span>
          )}
          {todo.label && (
            <span className="inline-flex items-center rounded-full bg-subtle px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted">
              {todo.label}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function ViewTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        `flex-1 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ` +
        (active
          ? "bg-card text-fg shadow-soft"
          : "text-muted hover:text-fg")
      }
    >
      {label}
    </button>
  );
}

function ClockIcon() {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function AlertIcon() {
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
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}
