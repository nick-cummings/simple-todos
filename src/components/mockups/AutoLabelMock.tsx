"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Design exploration for the Auto-labeling feature: as you type a
 * todo title, suggested labels surface as chips directly under the
 * title field. Tap a chip to accept it; the label moves down into the
 * applied row. Tap an applied chip to remove it (which makes it
 * eligible to be re-suggested).
 *
 * The suggestion engine here is a deliberately dumb keyword matcher —
 * the real feature will likely ask Claude — but it's enough to
 * demonstrate the suggest → accept interaction this mockup is about.
 *
 * Drop into a page like /mockups/auto-label (already wired) to preview
 * interactively.
 *
 * Open design questions for the real implementation:
 *  - Suggestions come from the model in the real version; how do we
 *    handle latency? (Optimistic skeleton chips while we wait?)
 *  - Should we suggest *new* labels the user doesn't have yet, or only
 *    rank existing ones? (This mock only ranks existing labels.)
 *  - Cap on how many suggestions to show at once before it's noise.
 *  - Where this slots into TodoModal relative to the LabelPicker chips.
 */

import { useMemo, useState } from "react";
import { type Label, swatchFor } from "@/lib/labels";

const SEED_LABELS: Label[] = [
  { name: "bills", color: "red", createdAt: 1 },
  { name: "dinner", color: "orange", createdAt: 2 },
  { name: "errands", color: "green", createdAt: 3 },
  { name: "home", color: "teal", createdAt: 4 },
  { name: "judith", color: "pink", createdAt: 5 },
  { name: "recipes", color: "purple", createdAt: 6 },
  { name: "subscription", color: "blue", createdAt: 7 },
  { name: "work", color: "amber", createdAt: 8 },
];

// Keyword → label-name hints the toy matcher uses to score a title.
// A label is always also matched by its own name appearing in the text.
const KEYWORDS: Record<string, string[]> = {
  bills: ["pay", "rent", "invoice", "electric", "insurance", "due", "bill"],
  dinner: ["cook", "meal", "eat", "restaurant", "reservation"],
  errands: ["buy", "store", "groceries", "pharmacy", "pick up", "drop off"],
  home: ["clean", "fix", "house", "garden", "laundry", "vacuum"],
  judith: ["mom", "judith", "call her", "grandma"],
  recipes: ["recipe", "bake", "cook", "ingredients"],
  subscription: ["cancel", "renew", "plan", "trial", "membership"],
  work: ["meeting", "email", "report", "deadline", "project", "slides"],
};

const SAMPLE_TITLE = "Pick up groceries and pay the electric bill";

interface Suggestion {
  label: Label;
  score: number;
}

/**
 * Toy suggestion engine. Scores each not-yet-applied label by how many
 * of its keywords (plus its own name) appear in the lowercased title,
 * and returns the matches strongest-first.
 */
function suggest(
  title: string,
  labels: Label[],
  applied: ReadonlySet<string>,
): Suggestion[] {
  const text = title.toLowerCase();
  if (text.trim() === "") return [];

  const out: Suggestion[] = [];
  for (const label of labels) {
    const key = label.name.toLowerCase();
    if (applied.has(key)) continue;

    const needles = [key, ...(KEYWORDS[key] ?? [])];
    let score = 0;
    for (const needle of needles) {
      if (text.includes(needle)) score += 1;
    }
    if (score > 0) out.push({ label, score });
  }

  return out.sort(
    (a, b) => b.score - a.score || a.label.createdAt - b.label.createdAt,
  );
}

export default function AutoLabelMock() {
  const [title, setTitle] = useState(SAMPLE_TITLE);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const suggestions = useMemo(
    () => suggest(title, SEED_LABELS, applied),
    [title, applied],
  );

  function accept(name: string) {
    setApplied((prev) => new Set(prev).add(name.toLowerCase()));
  }

  function remove(name: string) {
    setApplied((prev) => {
      const next = new Set(prev);
      next.delete(name.toLowerCase());
      return next;
    });
  }

  const appliedLabels = SEED_LABELS.filter((l) =>
    applied.has(l.name.toLowerCase()),
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          Mockup
        </span>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">
          Auto-label suggestions
        </h1>
        <p className="text-[13px] text-muted">
          As you type a title, matching labels are suggested below the
          field. Tap a suggestion to accept it.
        </p>
      </header>

      {/* Simulated new-todo title section */}
      <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-3">
          <label
            htmlFor="auto-label-title"
            className="text-xs text-muted"
          >
            Title
          </label>
          <input
            id="auto-label-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-[15px] text-fg outline-none placeholder:text-faint focus:border-fg/30"
          />

          {/* Suggested-label chips, directly under the title field */}
          <div
            className="flex min-h-[1.75rem] flex-col gap-1.5"
            aria-live="polite"
          >
            {suggestions.length > 0 ? (
              <>
                <span className="text-[11px] text-faint">
                  Suggested · tap to add
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map(({ label }) => {
                    const swatch = swatchFor(label.color);
                    return (
                      <button
                        key={label.name}
                        type="button"
                        onClick={() => accept(label.name)}
                        aria-label={`Add suggested label ${label.name}`}
                        className="tag-pill items-center transition-all active:scale-[0.96]"
                        style={{
                          color: swatch.fg,
                          backgroundColor: "transparent",
                          border: `1px dashed ${swatch.fg}66`,
                          opacity: 0.85,
                          textTransform: "none",
                        }}
                      >
                        <span aria-hidden className="mr-1 font-bold">
                          +
                        </span>
                        {label.name}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <span className="text-[11px] text-faint">
                {title.trim() === ""
                  ? "Start typing to see suggestions…"
                  : "No matching labels — try “dinner”, “pay rent”, or “email”."}
              </span>
            )}
          </div>

          <div className="mt-1 border-t border-line pt-3">
            <span className="mb-2 block text-xs text-muted">
              Labels on this todo{" "}
              <span className="text-faint">(tap to remove)</span>
            </span>
            {appliedLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {appliedLabels.map((label) => {
                  const swatch = swatchFor(label.color);
                  return (
                    <button
                      key={label.name}
                      type="button"
                      onClick={() => remove(label.name)}
                      aria-label={`Remove label ${label.name}`}
                      className="tag-pill items-center transition-all active:scale-[0.96]"
                      style={{
                        color: swatch.fg,
                        backgroundColor: swatch.bg,
                        border: `1px solid ${swatch.fg}33`,
                        textTransform: "none",
                      }}
                    >
                      {label.name}
                      <span aria-hidden className="ml-1 opacity-60">
                        ×
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-faint">
                None yet — accept a suggestion above.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
