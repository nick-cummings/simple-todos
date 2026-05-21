"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Demonstrates the proposed "delete with undo" flow. Tapping Delete
 * on a todo immediately removes it from the list and spawns a toast
 * at the bottom of the screen with a 5-second countdown. Tapping
 * Undo restores the todo; otherwise the deletion commits when the
 * timer expires.
 *
 * Notes:
 *  - Toast lives above the FAB and above safe-area-inset-bottom.
 *  - Progress bar bleeds the time visually so users don't need to
 *    read the seconds.
 *  - Stacking strategy: if a second delete happens while a toast
 *    is live, the previous deletion commits immediately and a new
 *    toast replaces it (iOS Mail pattern).
 *  - Real implementation would lift toast state into TodoApp and
 *    use a portal so it doesn't get clipped by overflow:hidden.
 */

import { useEffect, useRef, useState } from "react";

type Todo = { id: string; title: string };

const SEED: Todo[] = [
  { id: "1", title: "Buy milk" },
  { id: "2", title: "Email Bob about the proposal" },
  { id: "3", title: "Plan weekend trip" },
  { id: "4", title: "Renew library books" },
];

const UNDO_MS = 5000;

export default function UndoToastMock() {
  const [todos, setTodos] = useState<Todo[]>(SEED);
  const [pending, setPending] = useState<Todo | null>(null);
  const [remaining, setRemaining] = useState(UNDO_MS);
  const timerRef = useRef<null | number>(null);
  const startedAt = useRef(0);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startUndoWindow(todo: Todo) {
    setPending(todo);
    setRemaining(UNDO_MS);
    startedAt.current = Date.now();
    clearTimer();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const left = Math.max(0, UNDO_MS - elapsed);
      setRemaining(left);
      if (left === 0) {
        setPending(null);
        clearTimer();
      }
    }, 50);
  }

  function handleDelete(todo: Todo) {
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    startUndoWindow(todo);
  }

  function handleUndo() {
    if (!pending) return;
    setTodos((prev) => [pending, ...prev]);
    setPending(null);
    clearTimer();
  }

  useEffect(() => clearTimer, []);

  const progress = (remaining / UNDO_MS) * 100;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-5 pt-10 pb-32 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-5xl font-semibold leading-none tracking-[-0.045em]">
          todos
        </h1>
        <p className="text-[13px] text-muted">
          Mockup — delete an item to see the undo toast.
        </p>
      </header>

      <ul className="flex flex-col gap-2.5">
        {todos.map((t) => (
          <li
            key={t.id}
            className="group relative flex items-center gap-3.5 rounded-xl border border-line bg-card px-5 py-4 shadow-soft"
          >
            <span className="h-5 w-5 shrink-0 rounded-full border-[1.5px] border-line-emphasis" />
            <span className="flex-1 text-[15px] font-medium text-fg">
              {t.title}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(t)}
              className="rounded-md px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-faint hover:bg-danger-bg hover:text-danger"
            >
              Delete
            </button>
          </li>
        ))}
        {todos.length === 0 && (
          <li className="rounded-xl border border-dashed border-line py-12 text-center text-[13px] text-muted">
            Everything deleted — try undoing.
          </li>
        )}
      </ul>

      {pending && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-6 z-50 mx-auto flex max-w-md items-center gap-3 overflow-hidden rounded-xl border border-line bg-card px-4 py-3 shadow-pop animate-pop-in"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1 origin-left bg-primary"
            style={{
              transform: `scaleX(${progress / 100})`,
              transition: "transform 50ms linear",
            }}
          />
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger">
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
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </span>
          <span className="flex-1 truncate text-[14px] text-fg">
            Deleted &ldquo;{pending.title}&rdquo;
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="shrink-0 rounded-md px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-primary hover:bg-primary-bg"
          >
            Undo
          </button>
        </div>
      )}
    </main>
  );
}
