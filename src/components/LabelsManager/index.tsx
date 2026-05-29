"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { type LabelColor } from "@/lib/labels";
import { useLabels } from "@/lib/useLabels";
import { useTodos } from "@/lib/useTodos";

import { NewLabelRow } from "../NewLabelRow";
import { SortMenu } from "../SortMenu";
import { XIcon } from "./Icons";
import { LabelRow } from "./LabelRow";

interface Props {
  onClose: () => void;
  open: boolean;
}

const EXIT_MS = 220;

type SortKey = "count" | "name" | "recent";

const SORT_LABELS: Record<SortKey, string> = {
  count: "Count",
  name: "Name",
  recent: "Recent",
};

export default function LabelsManager({ onClose, open }: Props) {
  if (!open) return null;
  return <LabelsManagerContent onClose={onClose} />;
}

// Conservative escape for use in attribute selectors. Replaces double
// quotes and backslashes which are the only chars that break
// [attr="..."] form.
function cssEscape(s: string): string {
  return s.replaceAll("\\", "\\\\").replaceAll('"', String.raw`\"`);
}

function LabelsManagerContent({ onClose }: { onClose: () => void }) {
  const { addLabel, deleteLabel, labels, recolorLabel, renameLabel } =
    useLabels();
  const { todos } = useTodos();
  const [sort, setSort] = useState<SortKey>("recent");
  const [pendingScrollId, setPendingScrollId] = useState<null | string>(null);
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Count of todos using each label name (case-insensitive lookup).
  const labelCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of todos) {
      for (const l of t.labels) {
        const key = l.toLowerCase();
        m.set(key, (m.get(key) ?? 0) + 1);
      }
    }
    return m;
  }, [todos]);

  const sortedLabels = useMemo(() => {
    switch (sort) {
      case "count": {
        return labels.toSorted((a, b) => {
          const ac = labelCounts.get(a.name.toLowerCase()) ?? 0;
          const bc = labelCounts.get(b.name.toLowerCase()) ?? 0;
          return bc - ac || a.name.localeCompare(b.name);
        });
      }
      case "name": {
        return labels.toSorted((a, b) => a.name.localeCompare(b.name));
      }
      default: {
        // "recent" — and fallback for any unknown key.
        return labels.toSorted((a, b) => b.createdAt - a.createdAt);
      }
    }
  }, [labels, sort, labelCounts]);

  // After a new label is added, scroll its row into view.
  useEffect(() => {
    if (!pendingScrollId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(
      `[data-label-name="${cssEscape(pendingScrollId)}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setPendingScrollId(null);
  }, [pendingScrollId, sortedLabels]);

  const existingNames = useMemo(
    () => new Set(labels.map((l) => l.name.toLowerCase())),
    [labels],
  );

  function requestClose() {
    if (closing) return;
    setClosing(true);
    globalThis.setTimeout(() => {
      onClose();
    }, EXIT_MS);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => {
      globalThis.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAdd(name: string, color: LabelColor) {
    const added = addLabel(name, color);
    if (added) setPendingScrollId(added.name);
  }

  return (
    <div
      aria-label="Manage labels"
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 backdrop-blur-md sm:items-center sm:p-4 ${
        closing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      role="dialog"
    >
      <div
        className={`flex h-[85dvh] w-full max-w-md flex-col rounded-t-2xl bg-card shadow-pop sm:max-h-[720px] sm:rounded-2xl ${
          closing ? "animate-pop-out" : "animate-pop-in"
        }`}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle — mobile only */}
        <div className="flex shrink-0 justify-center pt-2.5 pb-1 sm:hidden">
          <span aria-hidden className="h-1 w-9 rounded-full bg-line-strong" />
        </div>

        {/* Header — fixed */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-6 pt-3 pb-4 sm:pt-6">
          <h2 className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-[-0.02em] text-fg">
              Labels
            </span>
            <span className="text-2xl font-semibold tracking-[-0.02em] text-faint">
              ({labels.length})
            </span>
          </h2>
          <div className="flex items-center gap-1.5">
            {labels.length > 0 && (
              <SortMenu
                ariaLabel="Sort labels by"
                labels={SORT_LABELS}
                onChange={setSort}
                value={sort}
                variant="compact"
              />
            )}
            <button
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-fg"
              onClick={requestClose}
              type="button"
            >
              <XIcon size={18} stroke={2} />
            </button>
          </div>
        </div>

        {/* Existing labels — scrolls */}
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-2"
          ref={scrollRef}
        >
          {labels.length === 0 && (
            <p className="px-6 py-6 text-center text-[13px] text-muted">
              No labels yet. Add one below.
            </p>
          )}
          {sortedLabels.map((label) => (
            <LabelRow
              count={labelCounts.get(label.name.toLowerCase()) ?? 0}
              key={label.name}
              label={label}
              onDelete={() => {
                deleteLabel(label.name);
              }}
              onRecolor={(c) => {
                recolorLabel(label.name, c);
              }}
              onRename={(next) => {
                renameLabel(label.name, next);
              }}
            />
          ))}
        </div>

        {/* Footer — fixed */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-line px-6 pt-4 pb-6">
          <NewLabelRow existingNames={existingNames} onAdd={handleAdd} />
          <button
            className="h-12 w-full rounded-xl bg-primary text-base font-medium text-on-primary hover:bg-primary-hover active:scale-[0.99]"
            onClick={requestClose}
            type="button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
