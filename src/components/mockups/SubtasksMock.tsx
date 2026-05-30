"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Demonstrates subtasks: a parent todo expands into a nested checklist.
 * Each subtask can be checked, reordered, and indented/outdented to
 * express a shallow hierarchy. The parent card grows a progress
 * indicator (bar + "done of total") driven by the checklist.
 *
 * Interactions wired with local state so a reviewer can feel the UX:
 *  - Add: the composer at the bottom appends a top-level subtask.
 *  - Check: clicking the checkbox toggles done; the parent progress
 *    updates live.
 *  - Reorder: the ↑/↓ controls swap a row with its neighbor.
 *  - Indent / outdent: the →/← controls nudge a row's depth (capped at
 *    one level of nesting — enough to group without becoming an
 *    outliner). A row can only indent if it has a row above it to
 *    nest under.
 *
 * Notes for the build issue (no data wiring here):
 *  - Likely data model: `subtasks: { id: string; title: string; done:
 *    boolean; depth: number }[]` on Todo, or a separate child-todo
 *    relation. Depth is a flat integer (0 = top level, 1 = nested) so
 *    reordering stays a simple array operation rather than tree
 *    surgery.
 *  - Parent progress = done leaves / total. A parent with subtasks is
 *    "complete" only when every subtask is done; toggling the last one
 *    is the natural place to auto-complete the parent.
 */

import { useMemo, useState } from "react";

type Subtask = {
  id: string;
  title: string;
  done: boolean;
  depth: 0 | 1;
};

const MAX_DEPTH = 1;

let nextId = 0;
const makeId = () => `s${nextId++}`;

const INITIAL: Subtask[] = [
  { id: makeId(), title: "Pick a venue", done: true, depth: 0 },
  { id: makeId(), title: "Confirm with the park office", done: true, depth: 1 },
  { id: makeId(), title: "Send invites", done: false, depth: 0 },
  { id: makeId(), title: "Order the cake", done: false, depth: 0 },
  { id: makeId(), title: "Ask about nut allergies", done: false, depth: 1 },
];

export default function SubtasksMock() {
  const [subtasks, setSubtasks] = useState<Subtask[]>(INITIAL);
  const [draft, setDraft] = useState("");

  const { done, total } = useMemo(
    () => ({
      done: subtasks.filter((s) => s.done).length,
      total: subtasks.length,
    }),
    [subtasks],
  );
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = total > 0 && done === total;

  function toggle(id: string) {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    );
  }

  function move(index: number, dir: -1 | 1) {
    setSubtasks((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function setDepth(index: number, delta: -1 | 1) {
    setSubtasks((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        // Can only indent under a preceding row.
        if (delta === 1 && index === 0) return s;
        const depth = Math.min(
          MAX_DEPTH,
          Math.max(0, s.depth + delta),
        ) as 0 | 1;
        return { ...s, depth };
      }),
    );
  }

  function remove(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  function add() {
    const title = draft.trim();
    if (!title) return;
    setSubtasks((prev) => [
      ...prev,
      { id: makeId(), title, done: false, depth: 0 },
    ]);
    setDraft("");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-5 pt-10 pb-32 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-5xl font-semibold leading-none tracking-[-0.045em]">
          todos
        </h1>
        <p className="text-[13px] text-muted">
          Mockup — subtasks. A todo expands into a nested checklist with a
          progress indicator on the parent. Try checking, reordering (↑↓),
          and indenting (→←).
        </p>
      </header>

      {/* Parent card */}
      <section className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-5 shadow-pop sm:p-6">
        <div className="flex items-start gap-3.5">
          <span
            className={
              `mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] ` +
              (allDone
                ? "border-primary bg-primary text-card"
                : "border-line-emphasis")
            }
            aria-hidden
          >
            {allDone && <CheckIcon />}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <span className="text-[17px] font-semibold text-fg">
              Plan birthday party
            </span>

            {/* Progress indicator */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-faint">
                <span>
                  {done} of {total} done
                </span>
                <span>{pct}%</span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-subtle"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done}
                aria-label="Subtasks completed"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <ul className="flex flex-col gap-1">
          {subtasks.map((s, i) => (
            <li
              key={s.id}
              className="group flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-subtle"
              style={{ marginLeft: s.depth * 28 }}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={s.done}
                onClick={() => toggle(s.id)}
                className={
                  `grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border-[1.5px] transition-colors ` +
                  (s.done
                    ? "border-primary bg-primary text-card"
                    : "border-line-emphasis hover:border-primary")
                }
              >
                {s.done && <CheckIcon />}
              </button>

              <span
                className={
                  `flex-1 truncate text-[14px] ` +
                  (s.done
                    ? "text-faint line-through"
                    : "font-medium text-fg")
                }
              >
                {s.title}
              </span>

              {/* Row controls */}
              <div className="flex items-center gap-0.5 text-faint opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <IconButton
                  label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowIcon dir="up" />
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={i === subtasks.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowIcon dir="down" />
                </IconButton>
                <IconButton
                  label="Outdent"
                  disabled={s.depth === 0}
                  onClick={() => setDepth(i, -1)}
                >
                  <ArrowIcon dir="left" />
                </IconButton>
                <IconButton
                  label="Indent"
                  disabled={s.depth >= MAX_DEPTH || i === 0}
                  onClick={() => setDepth(i, 1)}
                >
                  <ArrowIcon dir="right" />
                </IconButton>
                <IconButton label="Delete" onClick={() => remove(s.id)}>
                  <TrashIcon />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>

        {/* Composer */}
        <form
          className="flex items-center gap-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <span className="grid h-[18px] w-[18px] shrink-0 place-items-center text-faint">
            <PlusIcon />
          </span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a subtask…"
            aria-label="Add a subtask"
            className="h-9 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={draft.trim() === ""}
            className="rounded-lg border border-line bg-subtle px-3 py-1.5 text-[13px] font-medium text-muted hover:bg-subtle-hover hover:text-fg disabled:opacity-40"
          >
            Add
          </button>
        </form>
      </section>
    </main>
  );
}

function IconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded-md hover:bg-subtle-hover hover:text-fg disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ArrowIcon({ dir }: { dir: "down" | "left" | "right" | "up" }) {
  const rotate = { up: 0, right: 90, down: 180, left: 270 }[dir];
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
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function TrashIcon() {
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
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
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
