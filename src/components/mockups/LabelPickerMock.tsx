"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Design exploration for picking an existing label when creating a
 * todo. Renders a togglable chip per known label, with selection
 * state encoded in the chip's fill. Tap once to add the label to
 * the todo, tap again to remove it.
 *
 * Drop into a page like /mockups/label-picker (already wired) to
 * preview interactively.
 *
 * Open design questions for the real implementation:
 *  - Where exactly does this slot into TodoModal's label section?
 *    (Above NewLabelRow? Below the selected-pills row, replacing it?)
 *  - Wrap vs. horizontal-scroll when there are 20+ labels?
 *  - Should already-selected chips show an explicit checkmark, or is
 *    fill-vs-outline enough?
 */

import { useMemo, useState } from "react";
import { type Label, swatchFor } from "@/lib/labels";
import { NewLabelRow } from "@/components/NewLabelRow";

const SEED_LABELS: Label[] = [
  { name: "bills",        color: "red",    createdAt: 1 },
  { name: "dinner",       color: "orange", createdAt: 2 },
  { name: "errands",      color: "green",  createdAt: 3 },
  { name: "home",         color: "teal",   createdAt: 4 },
  { name: "judith",       color: "pink",   createdAt: 5 },
  { name: "recipes",      color: "purple", createdAt: 6 },
  { name: "subscription", color: "blue",   createdAt: 7 },
  { name: "work",         color: "amber",  createdAt: 8 },
];

export default function LabelPickerMock() {
  const [labels, setLabels] = useState<Label[]>(SEED_LABELS);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["dinner", "judith"]),
  );

  const existingNames = useMemo(
    () => new Set(labels.map((l) => l.name.toLowerCase())),
    [labels],
  );

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = name.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleAdd(name: string, color: import("@/lib/labels").LabelColor) {
    setLabels((prev) => [...prev, { name, color, createdAt: Date.now() }]);
    setSelected((prev) => new Set(prev).add(name.toLowerCase()));
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          Mockup
        </span>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">
          Label picker
        </h1>
        <p className="text-[13px] text-muted">
          Browse all your labels and tap to add. Selected labels are
          filled; tap again to remove.
        </p>
      </header>

      {/* Simulated TodoModal label section */}
      <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-3">
          <span className="text-xs text-muted">
            Labels <span className="text-faint">(tap to toggle)</span>
          </span>

          {labels.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {labels.map((label) => {
                const isSelected = selected.has(label.name.toLowerCase());
                const swatch = swatchFor(label.color);
                return (
                  <button
                    key={label.name}
                    type="button"
                    onClick={() => toggle(label.name)}
                    aria-pressed={isSelected}
                    className="tag-pill items-center transition-all active:scale-[0.96]"
                    style={
                      isSelected
                        ? {
                            color: swatch.fg,
                            backgroundColor: swatch.bg,
                            border: `1px solid ${swatch.fg}33`,
                            textTransform: "none",
                          }
                        : {
                            color: swatch.fg,
                            backgroundColor: "transparent",
                            border: `1px dashed ${swatch.fg}66`,
                            opacity: 0.75,
                            textTransform: "none",
                          }
                    }
                  >
                    {label.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[12px] text-faint">
              No labels yet. Create one below.
            </p>
          )}

          <div className="mt-1 border-t border-line pt-3">
            <span className="mb-2 block text-xs text-muted">
              Or create a new label
            </span>
            <NewLabelRow
              existingNames={existingNames}
              onAdd={handleAdd}
              placeholder="New label name…"
            />
          </div>
        </div>
      </div>

      {/* Live selection summary, for the mockup only */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          Selected (debug — would be on the todo)
        </span>
        {selected.size === 0 ? (
          <span className="text-[12px] text-faint">none</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {[...selected].map((name) => {
              const label = labels.find(
                (l) => l.name.toLowerCase() === name,
              );
              if (!label) return null;
              const swatch = swatchFor(label.color);
              return (
                <span
                  key={name}
                  className="tag-pill"
                  style={{
                    color: swatch.fg,
                    backgroundColor: swatch.bg,
                    textTransform: "none",
                  }}
                >
                  {label.name}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
