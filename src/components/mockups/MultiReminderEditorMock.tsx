"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Demonstrates a *multi*-reminder editor: a single todo can carry
 * several reminders, each either
 *
 *  - **relative** — an offset before the due date ("1 day before",
 *    "1 hour before", "at due time"), or
 *  - **absolute** — a fixed wall-clock date + time independent of the
 *    due date.
 *
 * The editor lets the user add rows, remove rows, switch a row between
 * relative and absolute, and edit each row's value. A live summary
 * sorts the configured reminders into the order they'd fire.
 *
 * This extends the single-offset picker in RemindersMock to the
 * "several per todo" shape the real feature will need.
 *
 * Real implementation notes:
 *  - Today's data model stores one `reminder:<r-todoId>` per todo
 *    (see docs/features/reminders.md). Multi-reminder needs a list,
 *    e.g. `reminder:<todoId>:<n>` or a JSON array on the todo, plus a
 *    `fireAt` computed per entry (dueDate - offset, or the absolute
 *    instant).
 *  - The cron scan and dedupe logic are already per-reminder-record,
 *    so they extend naturally once each todo emits multiple records.
 *  - Absolute reminders don't depend on `dueDate`, so they stay valid
 *    even on todos with no due date.
 */

import { useState } from "react";

type RelativeOffset = "due" | "15m" | "1h" | "1d" | "1w";

const RELATIVE_OFFSETS: { value: RelativeOffset; label: string }[] = [
  { value: "due", label: "At due time" },
  { value: "15m", label: "15 min before" },
  { value: "1h", label: "1 hour before" },
  { value: "1d", label: "1 day before" },
  { value: "1w", label: "1 week before" },
];

type Reminder =
  | { id: string; kind: "relative"; offset: RelativeOffset }
  | { id: string; kind: "absolute"; at: string };

let nextId = 0;
function makeId() {
  nextId += 1;
  return `rem-${nextId}`;
}

const INITIAL: Reminder[] = [
  { id: makeId(), kind: "relative", offset: "1d" },
  { id: makeId(), kind: "relative", offset: "1h" },
  { id: makeId(), kind: "absolute", at: "2026-05-20T09:00" },
];

const DUE_DATE = "2026-05-21";

export default function MultiReminderEditorMock() {
  const [reminders, setReminders] = useState<Reminder[]>(INITIAL);

  function addRelative() {
    setReminders((prev) => [
      ...prev,
      { id: makeId(), kind: "relative", offset: "1h" },
    ]);
  }

  function addAbsolute() {
    setReminders((prev) => [
      ...prev,
      { id: makeId(), kind: "absolute", at: `${DUE_DATE}T09:00` },
    ]);
  }

  function remove(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  function setKind(id: string, kind: Reminder["kind"]) {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id
          ? kind === "relative"
            ? { id: r.id, kind: "relative", offset: "1h" }
            : { id: r.id, kind: "absolute", at: `${DUE_DATE}T09:00` }
          : r,
      ),
    );
  }

  function setOffset(id: string, offset: RelativeOffset) {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id && r.kind === "relative" ? { ...r, offset } : r,
      ),
    );
  }

  function setAbsolute(id: string, at: string) {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id && r.kind === "absolute" ? { ...r, at } : r,
      ),
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-5 pt-10 pb-32 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-5xl font-semibold leading-none tracking-[-0.045em]">
          todos
        </h1>
        <p className="text-[13px] text-muted">
          Mockup — multi-reminder editor. Add, remove, and mix relative and
          absolute reminders on a single todo.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)]">
        {/* Left: a live summary of the configured reminders */}
        <ReminderSummary reminders={reminders} />

        {/* Right: the editor */}
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-pop">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
            Edit todo
          </h2>

          <Field label="Title">
            <input
              value="Submit tax return"
              readOnly
              className="h-11 rounded-lg border border-line-strong bg-card px-3 text-base"
            />
          </Field>

          <Field label="Due date" optional>
            <input
              type="date"
              value={DUE_DATE}
              readOnly
              className="h-11 rounded-lg border border-line-strong bg-card px-3 text-sm"
            />
          </Field>

          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">
                Reminders <span className="text-faint">(optional)</span>
              </span>
              <span className="text-[11px] text-faint">
                {reminders.length}{" "}
                {reminders.length === 1 ? "reminder" : "reminders"}
              </span>
            </div>

            {reminders.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong bg-subtle px-3 py-4 text-center text-[13px] text-muted">
                No reminders yet. Add one below.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {reminders.map((r) => (
                  <li key={r.id}>
                    <ReminderRow
                      reminder={r}
                      onKind={(k) => setKind(r.id, k)}
                      onOffset={(o) => setOffset(r.id, o)}
                      onAbsolute={(at) => setAbsolute(r.id, at)}
                      onRemove={() => remove(r.id)}
                    />
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addRelative}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-subtle px-3 py-2 text-[13px] font-medium text-fg hover:bg-subtle-hover"
              >
                <PlusIcon />
                Add relative
              </button>
              <button
                type="button"
                onClick={addAbsolute}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-subtle px-3 py-2 text-[13px] font-medium text-fg hover:bg-subtle-hover"
              >
                <PlusIcon />
                Add absolute
              </button>
            </div>

            <p className="text-[11px] text-faint">
              Relative reminders fire at <code>due date − offset</code>;
              absolute ones fire at the chosen instant regardless of the due
              date. Scheduling is a mockup only.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function ReminderRow({
  reminder,
  onKind,
  onOffset,
  onAbsolute,
  onRemove,
}: {
  reminder: Reminder;
  onKind: (kind: Reminder["kind"]) => void;
  onOffset: (offset: RelativeOffset) => void;
  onAbsolute: (at: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <KindToggle kind={reminder.kind} onKind={onKind} />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove reminder"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle-hover hover:text-fg"
        >
          <TrashIcon />
        </button>
      </div>

      {reminder.kind === "relative" ? (
        <label className="flex flex-col gap-1">
          <span className="sr-only">Offset before due date</span>
          <select
            value={reminder.offset}
            onChange={(e) => onOffset(e.target.value as RelativeOffset)}
            className="h-10 rounded-lg border border-line-strong bg-card px-2 text-[13px]"
          >
            {RELATIVE_OFFSETS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="sr-only">Reminder date and time</span>
          <input
            type="datetime-local"
            value={reminder.at}
            onChange={(e) => onAbsolute(e.target.value)}
            className="h-10 rounded-lg border border-line-strong bg-card px-2 text-[13px]"
          />
        </label>
      )}
    </div>
  );
}

function KindToggle({
  kind,
  onKind,
}: {
  kind: Reminder["kind"];
  onKind: (kind: Reminder["kind"]) => void;
}) {
  const kinds: { value: Reminder["kind"]; label: string }[] = [
    { value: "relative", label: "Relative" },
    { value: "absolute", label: "Absolute" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-line-strong bg-card p-0.5">
      {kinds.map((k) => {
        const active = kind === k.value;
        return (
          <button
            key={k.value}
            type="button"
            onClick={() => onKind(k.value)}
            aria-pressed={active}
            className={
              `rounded-md px-2.5 py-1 text-[12px] font-medium ` +
              (active
                ? "bg-primary text-on-primary"
                : "text-muted hover:text-fg")
            }
          >
            {k.label}
          </button>
        );
      })}
    </div>
  );
}

function ReminderSummary({ reminders }: { reminders: Reminder[] }) {
  const lines = reminders
    .map((r) => ({ id: r.id, ...describe(r) }))
    .sort((a, b) => a.sortKey - b.sortKey);

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
        Will notify
      </span>
      <div className="w-full max-w-[360px] rounded-2xl border border-line bg-subtle p-4 shadow-fab">
        {lines.length === 0 ? (
          <p className="text-center text-[13px] text-muted">
            No reminders scheduled.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {lines.map((l) => (
              <li key={l.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
                  <BellIcon />
                </span>
                <span className="text-[13px] text-fg">{l.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="max-w-xs text-center text-[11px] text-faint">
        Each reminder deep-links into the todo when tapped.
      </p>
    </div>
  );
}

/** Human-readable label + a sort key (minutes-from-epoch-ish) for ordering. */
function describe(r: Reminder): { text: string; sortKey: number } {
  const dueMs = new Date(`${DUE_DATE}T00:00`).getTime();
  if (r.kind === "absolute") {
    const ms = new Date(r.at).getTime();
    return { text: formatAbsolute(r.at), sortKey: ms };
  }
  const offsetMin: Record<RelativeOffset, number> = {
    due: 0,
    "15m": 15,
    "1h": 60,
    "1d": 60 * 24,
    "1w": 60 * 24 * 7,
  };
  const min = offsetMin[r.offset];
  const fireMs = dueMs - min * 60_000;
  const label =
    RELATIVE_OFFSETS.find((o) => o.value === r.offset)?.label ?? r.offset;
  return { text: label, sortKey: fireMs };
}

function formatAbsolute(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

function BellIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
