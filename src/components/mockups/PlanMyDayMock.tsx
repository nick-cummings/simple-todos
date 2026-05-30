"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Demonstrates the "Plan my day" review screen (part of the AI
 * Plan-my-day feature). The user opens a screen where an assistant has
 * proposed an order for today's todos, each with a one-line rationale and
 * a rough time estimate. The user reviews the order, nudges items up/down
 * to taste, then accepts the plan — at which point the ordering would be
 * applied to the real list.
 *
 * Notes:
 *  - The AI response here is a hardcoded stub (`STUB_PROPOSAL`). There is
 *    no network call: this mockup is only about the review + accept
 *    interaction, not the generation. A real build would replace the stub
 *    with a call mirroring `/api/generate-description`.
 *  - Reorder is exposed as explicit up/down buttons rather than drag, so
 *    the interaction is keyboard-accessible and easy to demonstrate. A
 *    real build could layer drag on top.
 *  - "Regenerate" is a no-op stub that just resets to the original
 *    proposed order, standing in for a fresh AI call.
 *  - Accepting swaps the screen to a confirmation state; "Review again"
 *    returns to the editable list so the flow is round-trippable in the
 *    mockup.
 */

import { useState } from "react";

type PlanItem = {
  id: string;
  title: string;
  reason: string;
  estimate: string;
};

const STUB_PROPOSAL: PlanItem[] = [
  {
    id: "standup",
    title: "Prep for 10am standup",
    reason: "Time-boxed and soonest on the clock",
    estimate: "10 min",
  },
  {
    id: "review",
    title: "Review Dana's PR",
    reason: "Teammate is blocked waiting on this",
    estimate: "25 min",
  },
  {
    id: "draft",
    title: "Draft the Q3 planning doc",
    reason: "Deep-focus work — best before lunch",
    estimate: "1.5 hrs",
  },
  {
    id: "email",
    title: "Clear inbox to zero",
    reason: "Low effort, good post-lunch reset",
    estimate: "20 min",
  },
  {
    id: "plants",
    title: "Water the plants",
    reason: "No deadline — fine to end the day on",
    estimate: "5 min",
  },
];

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function PlanMyDayMock() {
  const [items, setItems] = useState<PlanItem[]>(STUB_PROPOSAL);
  const [accepted, setAccepted] = useState(false);

  const moveUp = (i: number) => setItems((cur) => move(cur, i, i - 1));
  const moveDown = (i: number) => setItems((cur) => move(cur, i, i + 1));
  const regenerate = () => setItems(STUB_PROPOSAL);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-5 pt-10 pb-32 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-5xl font-semibold leading-none tracking-[-0.045em]">
          todos
        </h1>
        <p className="text-[13px] text-muted">
          Mockup — Plan my day. The assistant proposes an order for today;
          review, reorder, and accept.
        </p>
      </header>

      {accepted ? (
        <AcceptedPanel items={items} onReview={() => setAccepted(false)} />
      ) : (
        <section className="flex flex-col gap-5">
          <div className="flex items-start gap-3 rounded-2xl border border-primary-border bg-primary-bg px-5 py-4">
            <SparkIcon />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-medium text-primary">
                Suggested plan for today
              </p>
              <p className="text-[12px] leading-relaxed text-muted">
                Front-loaded your time-sensitive and deep-focus work, then
                tapered into lighter tasks. Reorder anything that doesn&apos;t
                fit your day, then accept.
              </p>
            </div>
          </div>

          <ol className="flex flex-col gap-2.5">
            {items.map((item, i) => (
              <li
                key={item.id}
                className="flex items-start gap-3.5 rounded-xl border border-line bg-card px-4 py-3.5 shadow-soft"
              >
                <span
                  className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-[12px] font-semibold text-muted"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-medium text-fg">
                      {item.title}
                    </span>
                    <span className="shrink-0 text-[11px] font-medium text-faint">
                      {item.estimate}
                    </span>
                  </div>
                  <span className="text-[12px] leading-snug text-muted">
                    {item.reason}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <ReorderButton
                    label={`Move ${item.title} up`}
                    disabled={i === 0}
                    onClick={() => moveUp(i)}
                  >
                    <ChevronIcon direction="up" />
                  </ReorderButton>
                  <ReorderButton
                    label={`Move ${item.title} down`}
                    disabled={i === items.length - 1}
                    onClick={() => moveDown(i)}
                  >
                    <ChevronIcon direction="down" />
                  </ReorderButton>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={regenerate}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-subtle px-4 py-2 text-[13px] font-medium text-muted hover:bg-subtle-hover hover:text-fg"
            >
              <SparkIcon />
              Regenerate
            </button>
            <button
              type="button"
              onClick={() => setAccepted(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-border bg-primary-bg px-5 py-2 text-[13px] font-semibold text-primary hover:brightness-95"
            >
              Accept plan
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function AcceptedPanel({
  items,
  onReview,
}: {
  items: PlanItem[];
  onReview: () => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-5 py-4 shadow-soft">
        <CheckIcon />
        <div className="flex flex-col gap-0.5">
          <p className="text-[14px] font-semibold text-fg">Plan accepted</p>
          <p className="text-[12px] text-muted">
            Today&apos;s todos are now in this order.
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-line bg-subtle px-4 py-2.5 text-[14px] text-fg"
          >
            <span className="text-[12px] font-semibold text-faint">
              {i + 1}
            </span>
            {item.title}
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onReview}
        className="self-start text-[13px] font-medium text-primary hover:underline"
      >
        ← Review again
      </button>
    </section>
  );
}

function ReorderButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-subtle disabled:hover:text-muted"
    >
      {children}
    </button>
  );
}

function ChevronIcon({ direction }: { direction: "down" | "up" }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: direction === "down" ? "rotate(180deg)" : undefined }}
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function SparkIcon() {
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
      className="mt-0.5 shrink-0 text-primary"
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-primary"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
