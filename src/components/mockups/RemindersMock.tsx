"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Demonstrates Web Push reminders for due dates. Three states:
 *
 *  1. Permission gate — first-time prompt asking the user to enable
 *     reminders. Shown once, in a card under the header.
 *  2. Reminder picker — once permission is granted, the edit modal
 *     grows a "Remind me" row with offsets (At due time, 15min
 *     before, 1h before, 1d before).
 *  3. Notification preview — what an OS notification would look like
 *     when fired.
 *
 * Real implementation notes:
 *  - Notification.requestPermission() on user gesture.
 *  - Service worker handles `push` events and renders the actual
 *    notification via `self.registration.showNotification(...)`.
 *  - Scheduling: simplest is client-side `setTimeout` for upcoming
 *    reminders, persisted by `dueDate - offset`; but they die when
 *    the tab closes. For reliability use Web Push from a server-side
 *    scheduler (Vercel Cron + Upstash + VAPID keys).
 *  - iOS PWA requires the user has Added to Home Screen for push
 *    permission to be available (iOS 16.4+).
 */

import { useState } from "react";

type Offset = "1d" | "1h" | "15m" | "due";

const OFFSETS: { value: Offset; label: string }[] = [
  { value: "due", label: "At due time" },
  { value: "15m", label: "15 min before" },
  { value: "1h", label: "1 hour before" },
  { value: "1d", label: "1 day before" },
];

export default function RemindersMock() {
  const [permitted, setPermitted] = useState(false);
  const [offset, setOffset] = useState<Offset>("1h");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-5 pt-10 pb-32 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-5xl font-semibold leading-none tracking-[-0.045em]">
          todos
        </h1>
        <p className="text-[13px] text-muted">
          Mockup — reminders. Toggle the permission gate to see the picker
          appear.
        </p>
      </header>

      {/* (1) Permission gate — shown once until the user dismisses or enables */}
      {!permitted && (
        <section className="flex items-start gap-4 rounded-2xl border border-primary-border bg-primary-bg p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
            <BellIcon />
          </span>
          <div className="flex flex-col gap-2">
            <h2 className="text-[15px] font-semibold text-fg">
              Get reminded for due dates?
            </h2>
            <p className="text-[13px] text-muted">
              We&rsquo;ll send a notification at the time you choose for any
              todo with a due date. Permission stays on this device.
            </p>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setPermitted(true)}
                className="rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-on-primary hover:bg-primary-hover"
              >
                Enable reminders
              </button>
              <button
                type="button"
                onClick={() => setPermitted(true)}
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:bg-subtle hover:text-fg"
              >
                Not now
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,400px)]">
        {/* Left: an OS notification preview */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
            Notification preview
          </span>
          <div className="w-full max-w-[360px] rounded-2xl border border-line bg-subtle p-3 shadow-fab">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
                <BellIcon />
              </span>
              <div className="flex flex-1 flex-col">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-fg">
                    Todos
                  </span>
                  <span className="text-[11px] text-faint">now</span>
                </div>
                <p className="text-[13px] text-fg">Due in 1 hour</p>
                <p className="text-[13px] text-muted">Take out trash</p>
              </div>
            </div>
          </div>
          <p className="max-w-xs text-center text-[11px] text-faint">
            Tapping the notification deep-links into the todo and snoozes
            the reminder for 10 minutes.
          </p>
        </div>

        {/* Right: edit pane with the new Remind me row */}
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-pop">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
            Edit todo
          </h2>

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
              Remind me <span className="text-faint">(optional)</span>
            </span>
            {!permitted ? (
              <button
                type="button"
                onClick={() => setPermitted(true)}
                className="flex items-center justify-between rounded-lg border border-dashed border-line-strong bg-subtle px-3 py-2.5 text-left text-[13px] text-muted hover:border-line-emphasis hover:text-fg"
              >
                <span>Enable reminders to schedule notifications…</span>
                <span aria-hidden className="text-faint">
                  →
                </span>
              </button>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {OFFSETS.map((o) => {
                  const active = offset === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setOffset(o.value)}
                      aria-pressed={active}
                      className={
                        `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ` +
                        (active
                          ? "border-primary-border bg-primary-bg text-primary"
                          : "border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg")
                      }
                    >
                      <BellIcon />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-faint">
              Scheduled client-side for now. Server-side scheduling (Vercel
              Cron + VAPID) would survive tab close and iOS sleep.
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

function BellIcon() {
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
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
