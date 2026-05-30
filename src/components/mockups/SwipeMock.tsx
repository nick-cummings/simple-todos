"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Prototype for the "Swipe gestures" feature. Each todo row is a
 * draggable card: drag right to complete, drag left to delete. The
 * row tracks the pointer 1:1 while dragging and reveals a colored
 * action layer behind it (green check on the left, red trash on the
 * right) that fades in as you approach the commit threshold.
 *
 * Why this exists: the point of swiping is *feel*, and feel only
 * survives contact with a real thumb on a real iPhone. This page
 * exposes the two tuning knobs — the commit threshold (how far you
 * have to drag before release commits the action) and an "armed"
 * threshold (how far before the action color goes solid as a "let
 * go now" signal) — as on-screen sliders so they can be tuned by
 * hand on-device, no rebuild required.
 *
 * Notes:
 *  - Uses Pointer Events (works for touch on iOS Safari 13+ and for
 *    mouse on desktop), with setPointerCapture so a drag that leaves
 *    the row still tracks.
 *  - Horizontal-intent lock: the first few px of movement decide
 *    whether this is a horizontal swipe or a vertical scroll. If the
 *    gesture is vertical we bail and let the page scroll normally.
 *  - Released below threshold → the row springs back to 0 with a
 *    transition. Past threshold → it animates off-screen in the swipe
 *    direction, then the row is completed/removed.
 *  - Real implementation would live in TodoApp / TodoRow and operate
 *    on the real todo store; thresholds would be baked constants
 *    (whatever values feel right here), not sliders.
 */

import { useRef, useState } from "react";

type Todo = { id: string; title: string; done: boolean };

const SEED: Todo[] = [
  { id: "1", title: "Buy milk", done: false },
  { id: "2", title: "Email Bob about the proposal", done: false },
  { id: "3", title: "Plan weekend trip", done: false },
  { id: "4", title: "Renew library books", done: false },
  { id: "5", title: "Water the plants", done: true },
];

// Default tuning. Both are in CSS pixels of horizontal travel.
const DEFAULT_COMMIT = 96; // release past this → action commits
const DEFAULT_ARMED = 64; // past this → action color goes solid
// Direction lock: ignore the gesture as a swipe until it has moved
// this far horizontally, and treat it as a scroll if it goes this
// far vertically first.
const INTENT_PX = 10;
// How far off-screen the committed card flies before we drop it.
const FLY_OUT_PX = 480;

type Drag = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  locked: "none" | "horizontal" | "vertical";
};

export default function SwipeMock() {
  const [todos, setTodos] = useState<Todo[]>(SEED);
  const [commitPx, setCommitPx] = useState(DEFAULT_COMMIT);
  const [armedPx, setArmedPx] = useState(DEFAULT_ARMED);
  // Per-row visual offset. A non-dragging row sits at 0 (or flies out
  // when committing). Kept separate from `drag` so springs/fly-outs can
  // animate after the pointer is gone.
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const [animating, setAnimating] = useState<Record<string, boolean>>({});
  const dragRef = useRef<Drag | null>(null);

  function setOffset(id: string, dx: number) {
    setOffsets((prev) => ({ ...prev, [id]: dx }));
  }

  function commit(todo: Todo, direction: "right" | "left") {
    // Fly the card the rest of the way out, then apply the action.
    setAnimating((prev) => ({ ...prev, [todo.id]: true }));
    setOffset(todo.id, direction === "right" ? FLY_OUT_PX : -FLY_OUT_PX);
    window.setTimeout(() => {
      if (direction === "right") {
        // Complete: flip done, then spring back into place.
        setTodos((prev) =>
          prev.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)),
        );
        setAnimating((prev) => ({ ...prev, [todo.id]: false }));
        setOffset(todo.id, 0);
      } else {
        // Delete: drop the row entirely.
        setTodos((prev) => prev.filter((t) => t.id !== todo.id));
        setOffsets((prev) => {
          const next = { ...prev };
          delete next[todo.id];
          return next;
        });
        setAnimating((prev) => {
          const next = { ...prev };
          delete next[todo.id];
          return next;
        });
      }
    }, 200);
  }

  function springBack(id: string) {
    setAnimating((prev) => ({ ...prev, [id]: true }));
    setOffset(id, 0);
    window.setTimeout(() => {
      setAnimating((prev) => ({ ...prev, [id]: false }));
    }, 200);
  }

  function onPointerDown(e: React.PointerEvent, todo: Todo) {
    // Only primary button / touch / pen.
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragRef.current = {
      id: todo.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      locked: "none",
    };
    setAnimating((prev) => ({ ...prev, [todo.id]: false }));
  }

  function onPointerMove(e: React.PointerEvent, todo: Todo) {
    const drag = dragRef.current;
    if (!drag || drag.id !== todo.id || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (drag.locked === "none") {
      if (Math.abs(dx) < INTENT_PX && Math.abs(dy) < INTENT_PX) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical intent — abandon the swipe, let the page scroll.
        drag.locked = "vertical";
        dragRef.current = null;
        return;
      }
      drag.locked = "horizontal";
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    if (drag.locked !== "horizontal") return;
    drag.dx = dx;
    setOffset(todo.id, dx);
  }

  function onPointerUp(e: React.PointerEvent, todo: Todo) {
    const drag = dragRef.current;
    if (!drag || drag.id !== todo.id || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    const { dx } = drag;

    if (dx >= commitPx) {
      commit(todo, "right");
    } else if (dx <= -commitPx) {
      commit(todo, "left");
    } else {
      springBack(todo.id);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-5 pt-10 pb-32 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-5xl font-semibold leading-none tracking-[-0.045em]">
          todos
        </h1>
        <p className="text-[13px] text-muted">
          Mockup — drag a row right to complete, left to delete.
        </p>
      </header>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-line bg-card px-5 py-4 shadow-soft">
        <legend className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
          Tuning
        </legend>
        <label className="flex items-center gap-3 text-[13px] text-fg">
          <span className="w-28 shrink-0 text-muted">Commit at</span>
          <input
            type="range"
            min={40}
            max={200}
            step={4}
            value={commitPx}
            onChange={(e) => setCommitPx(Number(e.target.value))}
            className="flex-1 accent-primary"
            aria-label="Commit threshold in pixels"
          />
          <span className="w-14 shrink-0 text-right tabular-nums text-faint">
            {commitPx}px
          </span>
        </label>
        <label className="flex items-center gap-3 text-[13px] text-fg">
          <span className="w-28 shrink-0 text-muted">Arm at</span>
          <input
            type="range"
            min={24}
            max={Math.max(24, commitPx)}
            step={4}
            value={Math.min(armedPx, commitPx)}
            onChange={(e) => setArmedPx(Number(e.target.value))}
            className="flex-1 accent-primary"
            aria-label="Armed threshold in pixels"
          />
          <span className="w-14 shrink-0 text-right tabular-nums text-faint">
            {Math.min(armedPx, commitPx)}px
          </span>
        </label>
      </fieldset>

      <ul className="flex flex-col gap-2.5">
        {todos.map((t) => {
          const dx = offsets[t.id] ?? 0;
          const armed = Math.abs(dx) >= Math.min(armedPx, commitPx);
          const revealing = Math.abs(dx) > 0;
          const direction = dx > 0 ? "right" : "left";
          // Reveal opacity ramps from 0 at rest to 1 at the armed point.
          const revealOpacity = Math.min(1, Math.abs(dx) / Math.min(armedPx, commitPx));
          return (
            <li key={t.id} className="relative">
              {/* Action layer revealed behind the card. */}
              {revealing && (
                <div
                  aria-hidden
                  className={`absolute inset-0 flex items-center rounded-xl px-5 ${
                    direction === "right"
                      ? "justify-start bg-success"
                      : "justify-end bg-danger"
                  }`}
                  style={{ opacity: revealOpacity }}
                >
                  {direction === "right" ? (
                    <span
                      className={`flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-white transition-transform ${
                        armed ? "scale-110" : "scale-100"
                      }`}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      {t.done ? "Undo" : "Done"}
                    </span>
                  ) : (
                    <span
                      className={`flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-white transition-transform ${
                        armed ? "scale-110" : "scale-100"
                      }`}
                    >
                      Delete
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      </svg>
                    </span>
                  )}
                </div>
              )}

              {/* The draggable card. */}
              <div
                onPointerDown={(e) => onPointerDown(e, t)}
                onPointerMove={(e) => onPointerMove(e, t)}
                onPointerUp={(e) => onPointerUp(e, t)}
                onPointerCancel={(e) => onPointerUp(e, t)}
                className="group relative flex touch-pan-y select-none items-center gap-3.5 rounded-xl border border-line bg-card px-5 py-4 shadow-soft"
                style={{
                  transform: `translateX(${dx}px)`,
                  transition: animating[t.id]
                    ? "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)"
                    : "none",
                  touchAction: "pan-y",
                }}
              >
                <span
                  className={`h-5 w-5 shrink-0 rounded-full border-[1.5px] ${
                    t.done
                      ? "border-success bg-success"
                      : "border-line-emphasis"
                  }`}
                />
                <span
                  className={`flex-1 text-[15px] font-medium ${
                    t.done ? "text-faint line-through" : "text-fg"
                  }`}
                >
                  {t.title}
                </span>
              </div>
            </li>
          );
        })}
        {todos.length === 0 && (
          <li className="rounded-xl border border-dashed border-line py-12 text-center text-[13px] text-muted">
            Everything swiped away.
          </li>
        )}
      </ul>
    </main>
  );
}
