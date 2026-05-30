"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Design exploration for task priorities. Two surfaces:
 *  - Picker: the edit modal grows a "Priority" row with a segmented
 *    chip per level (None / Low / Medium / High). Each chip carries a
 *    flag icon tinted to its level color.
 *  - Indicator: on the list, a prioritized todo shows a colored flag
 *    next to its title plus a matching left accent bar, so urgency
 *    reads at a glance without opening the card.
 *
 * Drop into a page like /mockups/priorities (already wired) to preview
 * interactively.
 *
 * Open design questions for the real implementation:
 *  - Data model addition: `priority: "low" | "medium" | "high" | null`
 *    on Todo (None == null, the default).
 *  - Does priority drive sort order, or stay purely visual? If it
 *    sorts, how does it interact with the existing due-date ordering?
 *  - Is the left accent bar too heavy alongside label colors, or does
 *    the flag alone carry enough signal?
 */

import { useState } from "react";

type Priority = "high" | "low" | "medium" | "none";

const LEVELS: { value: Priority; label: string }[] = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

// Reuse the label swatch palette so priorities sit visually alongside
// the rest of the app's color language.
const PRIORITY_COLOR: Record<Exclude<Priority, "none">, string> = {
  low: "#3F86E8", // blue
  medium: "#C08A1E", // amber
  high: "#E0464F", // red
};

const PRIORITY_TINT: Record<Exclude<Priority, "none">, string> = {
  low: "rgb(63 134 232 / 0.10)",
  medium: "rgb(192 138 30 / 0.12)",
  high: "rgb(224 70 79 / 0.10)",
};

const CARDS: { title: string; priority: Priority; due: string }[] = [
  { title: "Submit tax documents", priority: "high", due: "Today" },
  { title: "Reply to landlord", priority: "medium", due: "Tomorrow · Wed" },
  { title: "Order new running shoes", priority: "low", due: "May 31" },
  { title: "Skim the design newsletter", priority: "none", due: "No date" },
];

function isLeveled(p: Priority): p is Exclude<Priority, "none"> {
  return p !== "none";
}

function colorFor(p: Priority): string | undefined {
  return isLeveled(p) ? PRIORITY_COLOR[p] : undefined;
}

function tintFor(p: Priority): string | undefined {
  return isLeveled(p) ? PRIORITY_TINT[p] : undefined;
}

export default function PriorityPickerMock() {
  const [selected, setSelected] = useState<Priority>("medium");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-5 pt-10 pb-32 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-5xl font-semibold leading-none tracking-[-0.045em]">
          todos
        </h1>
        <p className="text-[13px] text-muted">
          Mockup — priorities. Edit pane on the right shows the new
          Priority picker; the list shows the flag + accent indicator.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,400px)]">
        {/* Left: list with priority indicators */}
        <ul className="flex flex-col gap-2.5">
          {CARDS.map((t) => {
            const color = colorFor(t.priority);
            const tint = tintFor(t.priority);
            return (
              <li
                key={t.title}
                className="flex items-start gap-3.5 overflow-hidden rounded-xl border border-line bg-card px-5 py-4 shadow-soft"
                style={
                  color
                    ? { borderLeft: `3px solid ${color}` }
                    : undefined
                }
              >
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-[1.5px] border-line-emphasis" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2 text-[15px] font-medium text-fg">
                    {color && <FlagIcon color={color} />}
                    {t.title}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-faint">
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon />
                      {t.due}
                    </span>
                    {color && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold capitalize"
                        style={{ color, backgroundColor: tint }}
                      >
                        {t.priority}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Right: open edit pane showing the new Priority row */}
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-pop">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
              Edit todo
            </h2>
          </div>

          <Field label="Title">
            <input
              value="Reply to landlord"
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
              Priority <span className="text-faint">(optional)</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {LEVELS.map((p) => {
                const active = selected === p.value;
                const color = colorFor(p.value);
                const tint = tintFor(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setSelected(p.value)}
                    aria-pressed={active}
                    className={
                      `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ` +
                      (active
                        ? "border-line-strong bg-subtle text-fg"
                        : "border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg")
                    }
                    style={
                      active && color
                        ? {
                            color,
                            borderColor: `${color}66`,
                            backgroundColor: tint,
                          }
                        : undefined
                    }
                  >
                    {color && <FlagIcon color={color} />}
                    {p.label}
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-faint">
              Higher-priority todos carry a colored flag and left accent
              bar in the list, so urgency reads at a glance.
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

function FlagIcon({ color }: { color: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={color}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" fill="none" />
    </svg>
  );
}
