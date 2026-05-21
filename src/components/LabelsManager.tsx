"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  type Label,
  type LabelColor,
  swatchFor,
} from "@/lib/labels";
import { useLabels } from "@/lib/useLabels";
import { useTodos } from "@/lib/useTodos";

import { InlineColorPicker, NewLabelRow } from "./NewLabelRow";

type SortKey = "count" | "name" | "recent";

const SORT_LABELS: Record<SortKey, string> = {
  count: "Count",
  name: "Name",
  recent: "Recent",
};

interface Props {
  onClose: () => void;
  open: boolean;
}

const EXIT_MS = 220;

export default function LabelsManager({ onClose, open }: Props) {
  if (!open) return null;
  return <LabelsManagerContent onClose={onClose} />;
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
      width="18"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* ---------- Row ---------- */

function cssEscape(s: string): string {
  // Conservative escape for use in attribute selectors. Replaces
  // double quotes and backslashes which are the only chars that
  // break [attr="..."] form.
  return s.replaceAll('\\', "\\\\").replaceAll('"', String.raw`\"`);
}

/* ---------- Sort menu ---------- */

function LabelRow({
  count,
  label,
  onDelete,
  onRecolor,
  onRename,
}: {
  count: number;
  label: Label;
  onDelete: () => void;
  onRecolor: (c: LabelColor) => void;
  onRename: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label.name);
  const [offset, setOffset] = useState(0);
  const [peek, setPeek] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const swatch = swatchFor(label.color);
  const rowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    captured: false,
    startOffset: 0,
    startX: 0,
    startY: 0,
  });

  const PEEK_OFFSET = -88;
  const DELETE_THRESHOLD = -160;

  function commit() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== label.name) onRename(draft);
    else setDraft(label.name);
  }

  function startEdit() {
    setOffset(0);
    setPeek(false);
    setDraft(label.name);
    setEditing(true);
  }

  function triggerDelete() {
    setExiting(true);
    setOffset(-2000);
    globalThis.setTimeout(() => { onDelete(); }, 260);
  }

  function onTrashClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (peek) {
      setOffset(0);
      setPeek(false);
    } else {
      setOffset(PEEK_OFFSET);
      setPeek(true);
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (editing || exiting) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = {
      captured: false,
      startOffset: offset,
      startX: e.clientX,
      startY: e.clientY,
    };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (!dragRef.current.captured) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        setDragging(false);
        return;
      }
      dragRef.current.captured = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setOffset(Math.min(0, dragRef.current.startOffset + dx));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragging(false);
    if (!dragRef.current.captured) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (offset <= DELETE_THRESHOLD) {
      triggerDelete();
    } else if (offset < -40) {
      setOffset(PEEK_OFFSET);
      setPeek(true);
    } else {
      setOffset(0);
      setPeek(false);
    }
  }

  useEffect(() => {
    if (!peek) return;
    function onDown(e: MouseEvent) {
      if (!rowRef.current?.contains(e.target as Node)) {
        setOffset(0);
        setPeek(false);
      }
    }
    globalThis.addEventListener("mousedown", onDown);
    return () => { globalThis.removeEventListener("mousedown", onDown); };
  }, [peek]);

  return (
    <div
      className={
        `relative border-b border-line ${ 
        exiting
          ? "max-h-0 overflow-hidden opacity-0"
          : "max-h-[120px] overflow-x-clip opacity-100"}`
      }
      data-label-name={label.name}
      ref={rowRef}
      style={{
        borderBottomColor: exiting ? "transparent" : undefined,
        transition:
          "max-height 260ms ease-out, opacity 260ms ease-out, border-color 260ms ease-out",
      }}
    >
      <button
        aria-label={`Confirm delete ${label.name}`}
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center text-sm font-semibold text-white"
        onClick={triggerDelete}
        style={{
          backgroundColor: "var(--danger)",
          pointerEvents: peek ? "auto" : "none",
        }}
        tabIndex={peek ? 0 : -1}
        type="button"
      >
        Delete
      </button>

      <div
        className="flex items-center gap-2 bg-card px-6 py-3"
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          touchAction: "pan-y",
          transform: `translateX(${offset}px)`,
          transition: dragging
            ? "none"
            : "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {editing ? (
          <>
            <InlineColorPicker
              ariaLabel={`${label.name} color`}
              onChange={onRecolor}
              size="sm"
              value={label.color}
            />
            <input
              autoFocus
              className="h-9 min-w-0 flex-1 rounded-lg border-2 border-primary bg-card px-3 text-sm text-fg focus:outline-none"
              onChange={(e) => { setDraft(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(label.name);
                  setEditing(false);
                }
              }}
              value={draft}
            />
            <span className="shrink-0 tabular-nums text-sm text-faint">
              ({count})
            </span>
          </>
        ) : (
          <>
            <span
              className="tag-pill shrink-0"
              style={{ backgroundColor: swatch.bg, color: swatch.fg }}
            >
              {label.name}
            </span>
            <span className="shrink-0 tabular-nums text-sm text-faint">
              ({count})
            </span>
            <div className="min-w-0 flex-1" />
          </>
        )}

        {editing ? (
          <button
            aria-label="Save"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary-bg"
            onClick={commit}
            type="button"
          >
            <CheckIcon />
          </button>
        ) : (
          <button
            aria-label={`Edit ${label.name}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-faint hover:bg-subtle hover:text-fg"
            onClick={startEdit}
            type="button"
          >
            <PencilIcon />
          </button>
        )}

        <button
          aria-expanded={peek}
          aria-label={`Delete ${label.name}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-faint hover:bg-danger-bg hover:text-danger"
          onClick={onTrashClick}
          type="button"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}


/* ---------- Icons ---------- */

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
    globalThis.setTimeout(() => { onClose(); }, EXIT_MS);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => { globalThis.removeEventListener("keydown", onKey); };
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
      className={
        `fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 backdrop-blur-md sm:items-center sm:p-4 ${ 
        closing ? "animate-fade-out" : "animate-fade-in"}`
      }
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      role="dialog"
    >
      <div
        className={
          `flex h-[85dvh] w-full max-w-md flex-col rounded-t-2xl bg-card shadow-pop sm:max-h-[720px] sm:rounded-2xl ${ 
          closing ? "animate-pop-out" : "animate-pop-in"}`
        }
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
              <SortMenu onChange={setSort} value={sort} />
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
              onDelete={() => { deleteLabel(label.name); }}
              onRecolor={(c) => { recolorLabel(label.name, c); }}
              onRename={(next) => { renameLabel(label.name, next); }}
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

function PencilIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function SortMenu({
  onChange,
  value,
}: {
  onChange: (next: SortKey) => void;
  value: SortKey;
}) {
  return (
    <label className="relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card pl-4 pr-3 text-[13px] hover:border-line-strong hover:bg-card-hover">
      <span className="text-muted">Sort:</span>
      <span className="font-medium text-fg">{SORT_LABELS[value]}</span>
      <svg
        aria-hidden
        className="text-faint"
        fill="none"
        height="14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="14"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select
        aria-label="Sort labels by"
        className="absolute inset-0 w-full cursor-pointer opacity-0"
        onChange={(e) => { onChange(e.target.value as SortKey); }}
        value={value}
      >
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
          <option key={k} value={k}>
            {SORT_LABELS[k]}
          </option>
        ))}
      </select>
    </label>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/* ---------- Utilities ---------- */

function XIcon({ size = 14, stroke = 2 }: { size?: number; stroke?: number }) {
  return (
    <svg
      aria-hidden
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={stroke}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
