"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Demonstrates subtasks across the TWO surfaces the real build will use
 * (per #48): a lean "doing" surface and a richer "authoring" surface.
 * Subtasks are a FLAT checklist — no nesting/depth (per #46).
 *
 *  - Card (doing): checkbox + title per row, plus the parent's progress
 *    indicator (bar + "done of total"). Checking is the only interaction;
 *    no per-row reorder/delete and no composer — kept lean for the phone.
 *    An "Edit subtasks" affordance opens the authoring surface.
 *  - Authoring (modal): where management lives — rename, delete, the
 *    add-a-subtask composer, and reorder. Reorder is drag-first (the
 *    primary surface is the iPhone, so it must be touch-friendly) with an
 *    accessible fallback: ↑/↓ buttons plus ArrowUp/ArrowDown on the focused
 *    drag handle. The progress bar renders here too.
 *
 * The card↔modal split is an in-page toggle here; the real build puts
 * authoring in `TodoModal` and doing on `TodoCard` (no modal routing
 * needed for a mockup).
 *
 * Notes for the build issue (no data wiring here):
 *  - Data model (per #46): `subtasks: { id: string; title: string;
 *    done: boolean }[]` on Todo — a flat checklist, no nesting/depth.
 *  - Parent progress = done / total. Recommend progress-only for v1
 *    (no auto-complete of the parent); see #46.
 */

import { useMemo, useRef, useState } from "react";

type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

let nextId = 0;
const makeId = () => `s${nextId++}`;

const INITIAL: Subtask[] = [
  { id: makeId(), title: "Pick a venue", done: true },
  { id: makeId(), title: "Confirm with the park office", done: true },
  { id: makeId(), title: "Send invites", done: false },
  { id: makeId(), title: "Order the cake", done: false },
  { id: makeId(), title: "Ask about nut allergies", done: false },
];

export default function SubtasksMock() {
  const [subtasks, setSubtasks] = useState<Subtask[]>(INITIAL);
  const [authoring, setAuthoring] = useState(false);

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

  function rename(id: string, title: string) {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s)),
    );
  }

  function move(index: number, dir: -1 | 1) {
    moveTo(index, index + dir);
  }

  function moveTo(from: number, to: number) {
    setSubtasks((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function remove(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  function add(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSubtasks((prev) => [
      ...prev,
      { id: makeId(), title: trimmed, done: false },
    ]);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-5 pt-10 pb-32 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-5xl font-semibold leading-none tracking-[-0.045em]">
          todos
        </h1>
        <p className="text-[13px] text-muted">
          Mockup — subtasks. A flat checklist split across two surfaces: a
          lean card for checking things off, and an authoring view (open it
          with “Edit subtasks”) for reordering, renaming, and adding.
        </p>
      </header>

      {/* Card — the "doing" surface: lean, check-only. */}
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
            <ProgressIndicator done={done} total={total} pct={pct} />
          </div>
        </div>

        {/* Lean checklist: checkbox + title only. */}
        <ul className="flex flex-col gap-1">
          {subtasks.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2"
            >
              <Checkbox
                done={s.done}
                title={s.title}
                onToggle={() => toggle(s.id)}
              />
              <SubtaskTitle done={s.done} title={s.title} />
            </li>
          ))}
        </ul>

        <div className="flex border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setAuthoring(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-subtle px-3 py-1.5 text-[13px] font-medium text-muted hover:bg-subtle-hover hover:text-fg"
          >
            <PencilIcon />
            Edit subtasks
          </button>
        </div>
      </section>

      {authoring && (
        <AuthoringModal
          subtasks={subtasks}
          done={done}
          total={total}
          pct={pct}
          onClose={() => setAuthoring(false)}
          onToggle={toggle}
          onRename={rename}
          onMove={move}
          onMoveTo={moveTo}
          onRemove={remove}
          onAdd={add}
        />
      )}
    </main>
  );
}

function AuthoringModal({
  subtasks,
  done,
  total,
  pct,
  onClose,
  onToggle,
  onRename,
  onMove,
  onMoveTo,
  onRemove,
  onAdd,
}: {
  subtasks: Subtask[];
  done: number;
  total: number;
  pct: number;
  onClose: () => void;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onMoveTo: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onAdd: (title: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  function onHandlePointerDown(
    e: React.PointerEvent<HTMLButtonElement>,
    id: string,
  ) {
    e.preventDefault();
    // preventDefault() suppresses the default focus-on-pointerdown, which
    // would otherwise leave the keyboard-reorder fallback unreachable unless
    // the user Tabbed to the handle. Focus it explicitly so ArrowUp/ArrowDown
    // work after a click, matching the caption's a11y claim.
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragId(id);
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (dragId == null || !listRef.current) return;
    const rows = Array.from(
      listRef.current.querySelectorAll<HTMLElement>("[data-row]"),
    );
    const from = subtasks.findIndex((s) => s.id === dragId);
    if (from === -1) return;
    let to = from;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        to = i;
        break;
      }
      to = i;
    }
    if (to !== from) onMoveTo(from, to);
  }

  function endDrag() {
    setDragId(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Edit subtasks"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-t-2xl border border-line bg-card p-5 shadow-pop sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-fg">Edit subtasks</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-primary hover:bg-subtle"
          >
            Done
          </button>
        </div>

        <ProgressIndicator done={done} total={total} pct={pct} />

        <ul ref={listRef} className="flex flex-col gap-1">
          {subtasks.map((s, i) => {
            const dragging = dragId === s.id;
            return (
              <li
                key={s.id}
                data-row
                className={
                  `flex items-center gap-2 rounded-lg py-1.5 pr-1 ` +
                  (dragging
                    ? "bg-subtle ring-1 ring-line-emphasis"
                    : "hover:bg-subtle")
                }
              >
                <button
                  type="button"
                  aria-label={`Reorder ${s.title}`}
                  onPointerDown={(e) => onHandlePointerDown(e, s.id)}
                  onPointerMove={onHandlePointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      onMove(i, -1);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      onMove(i, 1);
                    }
                  }}
                  className="grid h-7 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-md text-faint hover:bg-subtle-hover hover:text-fg focus-visible:bg-subtle-hover focus-visible:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-line-emphasis active:cursor-grabbing"
                >
                  <GripIcon />
                </button>

                <Checkbox
                  done={s.done}
                  title={s.title}
                  onToggle={() => onToggle(s.id)}
                />

                <input
                  value={s.title}
                  onChange={(e) => onRename(s.id, e.target.value)}
                  aria-label={`Rename ${s.title}`}
                  className={
                    `h-8 min-w-0 flex-1 bg-transparent text-[14px] outline-none ` +
                    (s.done
                      ? "text-faint line-through"
                      : "font-medium text-fg")
                  }
                />

                <IconButton
                  label="Move up"
                  disabled={i === 0}
                  onClick={() => onMove(i, -1)}
                >
                  <ArrowIcon dir="up" />
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={i === subtasks.length - 1}
                  onClick={() => onMove(i, 1)}
                >
                  <ArrowIcon dir="down" />
                </IconButton>
                <IconButton label="Delete" onClick={() => onRemove(s.id)}>
                  <TrashIcon />
                </IconButton>
              </li>
            );
          })}
        </ul>

        <form
          className="flex items-center gap-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            onAdd(draft);
            setDraft("");
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

        <p className="text-[11px] text-faint">
          Drag the handle to reorder (touch-friendly). The ↑↓ buttons and
          ArrowUp/ArrowDown on a focused handle are the accessible fallback —
          reordering is never drag-only.
        </p>
      </div>
    </div>
  );
}

function ProgressIndicator({
  done,
  total,
  pct,
}: {
  done: number;
  total: number;
  pct: number;
}) {
  return (
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
  );
}

function Checkbox({
  done,
  title,
  onToggle,
}: {
  done: boolean;
  title: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={title}
      onClick={onToggle}
      className={
        `grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border-[1.5px] transition-colors ` +
        (done
          ? "border-primary bg-primary text-card"
          : "border-line-emphasis hover:border-primary")
      }
    >
      {done && <CheckIcon />}
    </button>
  );
}

function SubtaskTitle({ done, title }: { done: boolean; title: string }) {
  return (
    <span
      className={
        `flex-1 truncate text-[14px] ` +
        (done ? "text-faint line-through" : "font-medium text-fg")
      }
    >
      {title}
    </span>
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
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-faint hover:bg-subtle-hover hover:text-fg disabled:pointer-events-none disabled:opacity-25"
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

function ArrowIcon({ dir }: { dir: "down" | "up" }) {
  const rotate = { up: 0, down: 180 }[dir];
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

function PencilIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}
