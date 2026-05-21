"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Pop the toast in when this becomes non-null. */
  message: null | string;
  /** Fired when the window expires (committed). Not fired on undo. */
  onExpire: () => void;
  /** Fired if the user clicks Undo before the window closes. */
  onUndo: () => void;
  /** Total time the undo window stays live, in ms. */
  windowMs?: number;
}

// Matches --motion-base; keep in sync with the animate-pop-out
// duration so we don't unmount mid-animation.
const EXIT_MS = 220;
const DEFAULT_WINDOW_MS = 5000;
// Step interval for the progress-bar update. 50ms gives smooth
// motion without thrashing.
const TICK_MS = 50;

export default function UndoToast({
  message,
  onExpire,
  onUndo,
  windowMs = DEFAULT_WINDOW_MS,
}: Props) {
  const [closing, setClosing] = useState(false);
  // `visible` is the message we're currently showing, kept in local
  // state so we can play the exit animation after the parent clears
  // its pending value.
  const [visible, setVisible] = useState<null | string>(null);
  const [remaining, setRemaining] = useState(windowMs);
  // Timer handles. Use ReturnType<typeof set*> so the type covers both
  // browser (number) and Node (Timeout) signatures — happy-dom inherits
  // Node's setTimeout return type during tests.
  const tickRef = useRef<null | ReturnType<typeof setInterval>>(null);
  const exitRef = useRef<null | ReturnType<typeof setTimeout>>(null);
  const closingRef = useRef(false);
  const startedAt = useRef(0);

  function clearTick() {
    if (tickRef.current !== null) {
      globalThis.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }
  function clearExit() {
    if (exitRef.current !== null) {
      globalThis.clearTimeout(exitRef.current);
      exitRef.current = null;
    }
  }

  // Visual-only exit. The user-facing callback (onUndo/onExpire)
  // fires synchronously at the trigger; this just plays the
  // animation and unmounts.
  function dismiss() {
    if (closingRef.current) return;
    closingRef.current = true;
    clearTick();
    setClosing(true);
    clearExit();
    exitRef.current = globalThis.setTimeout(() => {
      setVisible(null);
      setClosing(false);
      closingRef.current = false;
      exitRef.current = null;
    }, EXIT_MS);
  }

  // Drive open/close on `message` changes. The setState calls here
  // are intentional: we're translating an external prop transition
  // (null → string) into internal animation state, which is the
  // textbook "sync prop to local state for animation timing" case.
  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    if (message === null) {
      if (visible !== null) dismiss();
      return;
    }
    // New message: cancel any in-flight exit so a fast second event
    // doesn't get swallowed.
    clearExit();
    closingRef.current = false;
    setClosing(false);
    setVisible(message);
    setRemaining(windowMs);
    startedAt.current = Date.now();
    clearTick();
    tickRef.current = globalThis.setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const left = Math.max(0, windowMs - elapsed);
      setRemaining(left);
      if (left === 0) {
        clearTick();
        onExpire();
        dismiss();
      }
    }, TICK_MS);
  }, [message]);
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  useEffect(
    () => () => {
      clearTick();
      clearExit();
    },
    [],
  );

  if (visible === null) return null;

  const progress = (remaining / windowMs) * 100;

  return (
    <div
      aria-live="polite"
      className={`fixed inset-x-0 bottom-6 z-50 mx-auto flex max-w-md items-center gap-3 overflow-hidden rounded-xl border border-line bg-card px-4 py-3 shadow-pop ${
        closing ? "animate-pop-out" : "animate-pop-in"
      }`}
      role="status"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1 origin-left bg-primary"
        style={{
          transform: `scaleX(${progress / 100})`,
          transition: `transform ${TICK_MS}ms linear`,
        }}
      />
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger">
        <svg
          aria-hidden
          fill="none"
          height="14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="14"
        >
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </span>
      <span className="flex-1 truncate text-[14px] text-fg">{visible}</span>
      <button
        className="shrink-0 rounded-md px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-primary hover:bg-primary-bg"
        onClick={() => {
          onUndo();
          dismiss();
        }}
        type="button"
      >
        Undo
      </button>
    </div>
  );
}
