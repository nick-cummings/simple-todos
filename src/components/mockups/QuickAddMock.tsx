"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Design exploration for an NLP "quick-add" bar: the user types one
 * line of free text ("Pay rent friday @bills !high") and the bar
 * previews the structured fields it parsed out — a due-date chip, one
 * or more label chips, and a priority chip — before they commit. The
 * raw title (with the recognized tokens stripped) shows alongside the
 * chips so it's obvious what will actually be saved.
 *
 * The parse here is a STUB. The real feature is expected to call an
 * NLP/AI endpoint; this local pattern-matcher stands in for that
 * response so the type → preview → confirm interaction can be reviewed
 * without a backend. It is intentionally shallow (a handful of date
 * keywords, `@label`, `!priority`) — enough to demo, not to ship.
 *
 * Drop into a page like /mockups/quick-add (already wired) to preview
 * interactively.
 *
 * Open design questions for the real implementation:
 *  - Does the parse run on every keystroke (live preview) or only on a
 *    debounce / explicit "parse" tap? Live feels better but costs an
 *    API call per keystroke if the backend is real.
 *  - How are ambiguous dates ("next friday" vs "friday") surfaced and
 *    corrected? Tap a chip to edit?
 *  - Should an unrecognized `@label` offer to create the label, or only
 *    match existing ones?
 *  - Where does this slot in relative to the existing TodoModal — does
 *    it replace the title field or sit above it as a fast path?
 */

import { useMemo, useState } from "react";
import { type LabelColor, swatchFor } from "@/lib/labels";
import { formatDueDate, type Priority, toISODate } from "@/lib/dates";

export interface ParsedQuickAdd {
  dueDate?: string; // ISO YYYY-MM-DD
  labels: string[];
  priority: Priority;
  title: string;
}

// Stand-in palette: in the real feature label colors come from the
// user's saved labels; here we cycle a fixed set so chips look right.
const DEMO_LABEL_COLORS: Record<string, LabelColor> = {
  bills: "red",
  errands: "green",
  home: "teal",
  work: "amber",
  judith: "pink",
};

const PRIORITY_SWATCH: Record<
  Exclude<Priority, "none">,
  { bg: string; fg: string }
> = {
  high: { bg: "#fee2e2", fg: "#b91c1c" },
  medium: { bg: "#fef3c7", fg: "#b45309" },
  low: { bg: "#e0f2fe", fg: "#0369a1" },
};

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Resolve a date keyword to an ISO date relative to today, or undefined. */
function resolveDateKeyword(word: string): string | undefined {
  const w = word.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (w === "today" || w === "tonight") return toISODate(today);
  if (w === "tomorrow") {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return toISODate(d);
  }

  const weekdayIndex = WEEKDAYS.indexOf(w as (typeof WEEKDAYS)[number]);
  if (weekdayIndex !== -1) {
    const delta = (weekdayIndex - today.getDay() + 7) % 7 || 7;
    const d = new Date(today);
    d.setDate(d.getDate() + delta);
    return toISODate(d);
  }

  return undefined;
}

const PRIORITY_WORDS: Record<string, Priority> = {
  high: "high",
  hi: "high",
  urgent: "high",
  med: "medium",
  medium: "medium",
  low: "low",
};

/**
 * STUB parser. Tokenizes the input and pulls out the first recognized
 * date keyword, every `@label`, and a `!priority` marker; whatever's
 * left becomes the title.
 */
export function parseQuickAdd(raw: string): ParsedQuickAdd {
  const labels: string[] = [];
  let dueDate: string | undefined;
  let priority: Priority = "none";
  const titleWords: string[] = [];

  for (const token of raw.split(/\s+/)) {
    if (!token) continue;

    if (token.startsWith("@") && token.length > 1) {
      const name = token.slice(1).toLowerCase();
      if (!labels.includes(name)) labels.push(name);
      continue;
    }

    if (token.startsWith("!") && token.length > 1) {
      const word = token.slice(1).toLowerCase();
      const mapped = PRIORITY_WORDS[word];
      if (mapped) {
        priority = mapped;
        continue;
      }
    }

    if (!dueDate) {
      const resolved = resolveDateKeyword(token);
      if (resolved) {
        dueDate = resolved;
        continue;
      }
    }

    titleWords.push(token);
  }

  return { dueDate, labels, priority, title: titleWords.join(" ") };
}

interface CommittedTodo extends ParsedQuickAdd {
  id: number;
}

export default function QuickAddMock() {
  const [input, setInput] = useState("Pay rent friday @bills !high");
  const [committed, setCommitted] = useState<CommittedTodo[]>([]);

  const parsed = useMemo(() => parseQuickAdd(input), [input]);
  const hasTokens =
    Boolean(parsed.dueDate) ||
    parsed.labels.length > 0 ||
    parsed.priority !== "none";
  const canConfirm = parsed.title.trim().length > 0;

  function confirm() {
    if (!canConfirm) return;
    setCommitted((prev) => [{ id: Date.now(), ...parsed }, ...prev]);
    setInput("");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          Mockup
        </span>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">
          Smart quick-add
        </h1>
        <p className="text-[13px] text-muted">
          Type one line — the bar previews the date, labels, and priority
          it parsed out before you commit. Try{" "}
          <code className="rounded bg-card px-1 py-0.5 text-[12px]">
            @work
          </code>
          ,{" "}
          <code className="rounded bg-card px-1 py-0.5 text-[12px]">
            tomorrow
          </code>
          , or{" "}
          <code className="rounded bg-card px-1 py-0.5 text-[12px]">
            !low
          </code>
          .
        </p>
      </header>

      {/* The quick-add bar */}
      <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
          className="flex flex-col gap-3"
        >
          <label htmlFor="quick-add" className="text-xs text-muted">
            Quick add{" "}
            <span className="text-faint">
              (type, then preview & confirm)
            </span>
          </label>
          <div className="flex gap-2">
            <input
              id="quick-add"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              placeholder="e.g. Call dentist tomorrow @home !high"
              className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-fg outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!canConfirm}
              className="rounded-xl bg-primary px-4 py-2 text-[14px] font-semibold text-white transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {/* Live token preview */}
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              Preview
            </span>
            {hasTokens ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {parsed.dueDate && (
                  <span
                    className="tag-pill items-center"
                    style={{
                      backgroundColor: "#ede9fe",
                      color: "#6d28d9",
                      textTransform: "none",
                    }}
                  >
                    📅 {formatDueDate(parsed.dueDate)}
                  </span>
                )}
                {parsed.priority !== "none" && (
                  <span
                    className="tag-pill items-center"
                    style={{
                      backgroundColor: PRIORITY_SWATCH[parsed.priority].bg,
                      color: PRIORITY_SWATCH[parsed.priority].fg,
                      textTransform: "none",
                    }}
                  >
                    ⚑ {parsed.priority}
                  </span>
                )}
                {parsed.labels.map((name) => {
                  const swatch = swatchFor(DEMO_LABEL_COLORS[name] ?? "gray");
                  return (
                    <span
                      key={name}
                      className="tag-pill items-center"
                      style={{
                        backgroundColor: swatch.bg,
                        color: swatch.fg,
                        textTransform: "none",
                      }}
                    >
                      @{name}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="text-[12px] text-faint">
                No tokens yet — the whole line is the title.
              </span>
            )}

            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-faint">Title</span>
              <span className="text-[14px] text-fg">
                {parsed.title.trim() || (
                  <span className="text-faint">
                    (empty — add some text to enable Add)
                  </span>
                )}
              </span>
            </div>
          </div>
        </form>
      </div>

      {/* Confirmed todos, for the mockup only */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          Added (debug — would be real todos)
        </span>
        {committed.length === 0 ? (
          <span className="text-[12px] text-faint">
            Nothing yet. Type a line above and tap Add.
          </span>
        ) : (
          <ul className="flex flex-col gap-2">
            {committed.map((todo) => (
              <li
                key={todo.id}
                className="rounded-xl border border-line bg-card px-3 py-2"
              >
                <div className="text-[14px] text-fg">{todo.title}</div>
                {(todo.dueDate ||
                  todo.priority !== "none" ||
                  todo.labels.length > 0) && (
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted">
                    {todo.dueDate && (
                      <span>📅 {formatDueDate(todo.dueDate)}</span>
                    )}
                    {todo.priority !== "none" && <span>⚑ {todo.priority}</span>}
                    {todo.labels.map((name) => (
                      <span key={name}>@{name}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
