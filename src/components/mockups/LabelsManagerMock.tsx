"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Demonstrates a proposed "Manage labels" sheet that lets the user
 * rename a label (propagating to every todo that uses it) and pick
 * its color. Render this anywhere to preview the flow, e.g. by
 * temporarily mounting <LabelsManagerMock open onClose={…} /> from
 * TodoApp.
 *
 * Visual notes:
 *  - Reuses the same outer shell, padding, and motion as TodoModal
 *    so it doesn't feel like a foreign surface.
 *  - Inline editing: tap the name to edit, blur or Enter to commit.
 *  - Color picker is a row of 8 swatches under each label; the
 *    pill preview updates live. In the real implementation, the
 *    chosen color writes to a label→color map and every pill in
 *    the app re-renders.
 *  - Delete is destructive — confirm step before stripping the
 *    label from every todo.
 */

import { useEffect, useMemo, useRef, useState } from "react";

type ColorKey =
  | "gray"
  | "red"
  | "orange"
  | "amber"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink";

// A label's color is either one of the named keys above or a raw
// hex string (#RRGGBB) chosen via the custom color picker.
type LabelColor = string;

type MockLabel = {
  id: string;
  name: string;
  color: LabelColor;
  count: number;
  createdAt: number;
};

type SortKey = "recent" | "name" | "count";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Recent",
  name: "Name",
  count: "Count",
};

const SWATCHES: Record<ColorKey, { fg: string; bg: string }> = {
  gray:   { fg: "#6B7280", bg: "rgb(107 114 128 / 0.12)" },
  red:    { fg: "#E0464F", bg: "rgb(224 70 79 / 0.10)" },
  orange: { fg: "#E2733A", bg: "rgb(226 115 58 / 0.12)" },
  amber:  { fg: "#C08A1E", bg: "rgb(192 138 30 / 0.12)" },
  green:  { fg: "#3C9A5F", bg: "rgb(60 154 95 / 0.12)" },
  teal:   { fg: "#2E9296", bg: "rgb(46 146 150 / 0.12)" },
  blue:   { fg: "#3F86E8", bg: "rgb(63 134 232 / 0.10)" },
  purple: { fg: "#8A5CF0", bg: "rgb(138 92 240 / 0.12)" },
  pink:   { fg: "#DA61A0", bg: "rgb(218 97 160 / 0.10)" },
};

function isNamedSwatch(color: LabelColor): color is ColorKey {
  return color in SWATCHES;
}

function swatchFor(color: LabelColor): { fg: string; bg: string } {
  if (isNamedSwatch(color)) return SWATCHES[color];
  return { fg: color, bg: hexToTintedBg(color) };
}

function hexToTintedBg(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "rgb(127 127 127 / 0.12)";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r} ${g} ${b} / 0.12)`;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const c = hex.replace("#", "");
  if (c.length !== 6) return { h: 0, s: 0, v: 0.5 };
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = (n: number) =>
    Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const SEED: MockLabel[] = [
  { id: "1", name: "bill",         color: "red",    count: 4, createdAt: 1 },
  { id: "2", name: "dinner",       color: "orange", count: 2, createdAt: 2 },
  { id: "3", name: "judith",       color: "pink",   count: 7, createdAt: 3 },
  { id: "4", name: "subscription", color: "blue",   count: 3, createdAt: 4 },
  { id: "5", name: "errand",       color: "green",  count: 1, createdAt: 5 },
];

type Props = {
  open?: boolean;
  onClose?: () => void;
};

export default function LabelsManagerMock({ open = true, onClose }: Props) {
  const [labels, setLabels] = useState<MockLabel[]>(SEED);
  const [sort, setSort] = useState<SortKey>("recent");
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sortedLabels = useMemo(() => {
    const copy = [...labels];
    switch (sort) {
      case "name":
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      case "count":
        return copy.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      case "recent":
      default:
        return copy.sort((a, b) => b.createdAt - a.createdAt);
    }
  }, [labels, sort]);

  // After a label is added, scroll it into view (its sorted position
  // may be anywhere in the list, so we look it up by id).
  useEffect(() => {
    if (!pendingScrollId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(
      `[data-label-id="${pendingScrollId}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setPendingScrollId(null);
  }, [pendingScrollId, sortedLabels]);

  if (!open) return null;

  function rename(id: string, next: string) {
    const trimmed = next.trim().replace(/\s+/g, " ");
    if (!trimmed) return;
    setLabels((prev) =>
      prev.map((l) => (l.id === id ? { ...l, name: trimmed } : l)),
    );
  }

  function recolor(id: string, color: LabelColor) {
    setLabels((prev) =>
      prev.map((l) => (l.id === id ? { ...l, color } : l)),
    );
  }

  function destroy(id: string) {
    setLabels((prev) => prev.filter((l) => l.id !== id));
  }

  function handleAdd(name: string, color: LabelColor) {
    const id = crypto.randomUUID();
    setLabels((prev) => [
      ...prev,
      { id, name, color, count: 0, createdAt: Date.now() },
    ]);
    setPendingScrollId(id);
  }

  const existingNames = useMemo(
    () => new Set(labels.map((l) => l.name.toLowerCase())),
    [labels],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage labels"
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 backdrop-blur-md sm:items-center sm:p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="flex h-[85dvh] w-full max-w-md flex-col rounded-t-2xl bg-card shadow-pop sm:max-h-[720px] sm:rounded-2xl animate-pop-in"
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
              <SortMenu value={sort} onChange={setSort} />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-fg"
            >
              <XIcon size={18} stroke={2} />
            </button>
          </div>
        </div>

        {/* Existing labels — scrolls. No horizontal padding so the
            swipe-to-delete red panel extends to the modal edge. */}
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-2"
        >
          {labels.length === 0 && (
            <p className="px-6 py-6 text-center text-[13px] text-muted">
              No labels yet. Add one below.
            </p>
          )}
          {sortedLabels.map((label) => (
            <LabelRow
              key={label.id}
              label={label}
              onRename={(next) => rename(label.id, next)}
              onRecolor={(c) => recolor(label.id, c)}
              onDelete={() => destroy(label.id)}
            />
          ))}
        </div>

        {/* Footer — fixed */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-line px-6 pt-4 pb-6">
          <NewLabelRow
            existingNames={existingNames}
            onAdd={handleAdd}
            placeholder="New label name…"
          />
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-xl bg-primary text-base font-medium text-on-primary hover:bg-primary-hover active:scale-[0.99]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Row ---------- */

function LabelRow({
  label,
  onRename,
  onRecolor,
  onDelete,
}: {
  label: MockLabel;
  onRename: (next: string) => void;
  onRecolor: (c: LabelColor) => void;
  onDelete: () => void;
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
    startX: 0,
    startY: 0,
    startOffset: 0,
    captured: false,
  });

  // iOS-style action width — wide enough to fit "Delete" comfortably.
  const PEEK_OFFSET = -88;
  // Past this, releasing fires a full delete instead of snapping to peek.
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
    // Sweep the foreground all the way off, then collapse — both
    // happen in the same animation window.
    setOffset(-2000);
    window.setTimeout(() => onDelete(), 260);
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
      startX: e.clientX,
      startY: e.clientY,
      startOffset: offset,
      captured: false,
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
        // Vertical intent — let the scroll container handle it.
        setDragging(false);
        return;
      }
      dragRef.current.captured = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const proposed = dragRef.current.startOffset + dx;
    setOffset(Math.min(0, proposed));
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

  // Close peek when clicking outside the row.
  useEffect(() => {
    if (!peek) return;
    function onDown(e: MouseEvent) {
      if (!rowRef.current?.contains(e.target as Node)) {
        setOffset(0);
        setPeek(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [peek]);

  return (
    <div
      ref={rowRef}
      data-label-id={label.id}
      className={
        // overflow-x-clip lets the swipe clip horizontally while the
        // color picker popover can still extend vertically beyond
        // the row. During exit we switch to full overflow-hidden so
        // the collapsing height clips its leftover content.
        "relative border-b border-line " +
        (exiting
          ? "max-h-0 overflow-hidden opacity-0"
          : "max-h-[120px] overflow-x-clip opacity-100")
      }
      style={{
        transition:
          "max-height 260ms ease-out, opacity 260ms ease-out, border-color 260ms ease-out",
        borderBottomColor: exiting ? "transparent" : undefined,
      }}
    >
      {/* Red "Delete" reveal — sits behind the foreground row. */}
      <button
        type="button"
        onClick={triggerDelete}
        aria-label={`Confirm delete ${label.name}`}
        tabIndex={peek ? 0 : -1}
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center text-sm font-semibold text-white"
        style={{
          backgroundColor: "var(--danger)",
          pointerEvents: peek ? "auto" : "none",
        }}
      >
        Delete
      </button>

      {/* Foreground row — pointer events drive the swipe. */}
      <div
        className="flex items-center gap-2 bg-card px-6 py-3"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging
            ? "none"
            : "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
          touchAction: "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {editing ? (
          <>
            <InlineColorPicker
              value={label.color}
              onChange={onRecolor}
              ariaLabel={`${label.name} color`}
              size="sm"
            />
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(label.name);
                  setEditing(false);
                }
              }}
              className="h-9 min-w-0 flex-1 rounded-lg border-2 border-primary bg-card px-3 text-sm text-fg focus:outline-none"
            />
            <span className="shrink-0 tabular-nums text-sm text-faint">
              ({label.count})
            </span>
          </>
        ) : (
          <>
            <span
              className="tag-pill shrink-0"
              style={{
                color: swatch.fg,
                backgroundColor: swatch.bg,
                textTransform: "none",
              }}
            >
              {label.name}
            </span>
            <span className="shrink-0 tabular-nums text-sm text-faint">
              ({label.count})
            </span>
            <div className="min-w-0 flex-1" />
          </>
        )}

        {editing ? (
          <button
            type="button"
            onClick={commit}
            aria-label="Save"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary-bg"
          >
            <CheckIcon />
          </button>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Edit ${label.name}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-faint hover:bg-subtle hover:text-fg"
          >
            <PencilIcon />
          </button>
        )}

        <button
          type="button"
          onClick={onTrashClick}
          aria-label={`Delete ${label.name}`}
          aria-expanded={peek}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-faint hover:bg-danger-bg hover:text-danger"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

/* ---------- New label row (reusable) ---------- */

/**
 * Single-row form for creating a new label. Designed to be embeddable
 * inside other surfaces (e.g. the todo create/edit modal) without
 * dragging the surrounding "Manage labels" chrome along.
 */
export function NewLabelRow({
  existingNames,
  onAdd,
  placeholder = "Label name",
}: {
  existingNames: Set<string>;
  onAdd: (name: string, color: LabelColor) => void;
  placeholder?: string;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("gray");

  function submit() {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) return;
    if (existingNames.has(trimmed.toLowerCase())) return;
    onAdd(trimmed, color);
    setName("");
    setColor("gray");
  }

  return (
    <div className="flex items-center gap-2">
      <InlineColorPicker
        value={color}
        onChange={setColor}
        ariaLabel="Label color"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-card px-3 text-sm placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!name.trim()}
        className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-40 active:scale-[0.98]"
      >
        Add
      </button>
    </div>
  );
}

/* ---------- Inline color picker (popover trigger) ---------- */

const RAINBOW_GRADIENT =
  "conic-gradient(from 0deg, #E0464F, #E2733A, #C08A1E, #3C9A5F, #2E9296, #3F86E8, #8A5CF0, #DA61A0, #E0464F)";

function InlineColorPicker({
  value,
  onChange,
  ariaLabel,
  size = "md",
}: {
  value: LabelColor;
  onChange: (c: LabelColor) => void;
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const buttonClass =
    size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const dotClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          "flex shrink-0 items-center justify-center rounded-lg border border-line-strong bg-card hover:border-line-emphasis hover:bg-card-hover " +
          buttonClass
        }
      >
        <span
          aria-hidden
          className={"block rounded-full border border-line " + dotClass}
          style={{ background: swatchFor(value).fg }}
        />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`${ariaLabel} options`}
          className="absolute bottom-full left-0 z-20 mb-2 w-max rounded-lg border border-line bg-card p-2.5 shadow-pop animate-pop-in"
        >
          <SwatchRow
            value={value}
            onChange={(c) => {
              onChange(c);
              // Close only when a named swatch is picked. Custom-picker
              // drags fire onChange on every pointer-move and must not
              // collapse the popover mid-drag.
              if (isNamedSwatch(c)) setOpen(false);
            }}
            ariaPrefix={ariaLabel}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- Swatch picker ---------- */

function SwatchRow({
  value,
  onChange,
  ariaPrefix,
}: {
  value: LabelColor;
  onChange: (c: LabelColor) => void;
  ariaPrefix: string;
}) {
  const keys = Object.keys(SWATCHES) as ColorKey[];
  const isCustom = !isNamedSwatch(value);
  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-1">
      {keys.map((k) => {
        const active = k === value;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            aria-label={`${ariaPrefix}: ${k}`}
            aria-pressed={active}
            className={
              "h-5 w-5 rounded-full border transition-transform active:scale-90 " +
              (active
                ? "border-fg ring-2 ring-offset-2 ring-offset-card"
                : "border-line hover:scale-110")
            }
            style={{
              backgroundColor: SWATCHES[k].fg,
              // @ts-expect-error CSS custom property used by the ring
              "--tw-ring-color": SWATCHES[k].fg,
            }}
          />
        );
      })}
      <CustomSwatch
        value={isCustom ? value : "#7c7c7c"}
        active={isCustom}
        onChange={onChange}
        ariaLabel={`${ariaPrefix}: custom`}
      />
    </div>
  );
}

function CustomSwatch({
  value,
  active,
  onChange,
  ariaLabel,
}: {
  value: string;
  active: boolean;
  onChange: (c: LabelColor) => void;
  ariaLabel: string;
}) {
  // Native <input type="color"> is unreliable in PWAs — Chrome drops
  // the picker downward off-screen when triggered near the top of the
  // viewport, and iOS/Firefox use OS dialogs we can't position. We
  // render our own picker in the DOM (like react-colorful does) so it
  // always opens predictably — upward, above the swatch.
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-pressed={active}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          "relative inline-flex h-5 w-5 items-center justify-center rounded-full border transition-transform active:scale-90 " +
          (active
            ? "border-fg ring-2 ring-offset-2 ring-offset-card"
            : "border-line hover:scale-110")
        }
        style={{
          background: active ? value : RAINBOW_GRADIENT,
          // @ts-expect-error CSS custom property used by the ring
          "--tw-ring-color": active ? value : "var(--fg)",
        }}
      >
        {!active && (
          <span
            aria-hidden
            className="pointer-events-none flex h-2.5 w-2.5 items-center justify-center rounded-full bg-card text-fg"
          >
            <svg
              width="7"
              height="7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`${ariaLabel} picker`}
          className="absolute bottom-full right-0 z-30 mb-2 rounded-lg border border-line bg-card p-2.5 shadow-pop animate-pop-in"
        >
          <CustomColorPicker
            value={active && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#FF4D4D"}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- Custom color picker (inline) ---------- */

function CustomColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const hsv = useMemo(() => hexToHsv(value), [value]);
  const padRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  function setFromPad(clientX: number, clientY: number) {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onChange(hsvToHex(hsv.h, x, 1 - y));
  }
  function setFromHue(clientX: number) {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(hsvToHex(x * 360, hsv.s || 1, hsv.v || 1));
  }

  return (
    <div className="flex w-44 flex-col gap-2">
      <div
        ref={padRef}
        role="application"
        aria-label="Saturation and brightness"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromPad(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            setFromPad(e.clientX, e.clientY);
          }
        }}
        className="relative h-28 cursor-crosshair touch-none rounded"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
          }}
        />
      </div>
      <div
        ref={hueRef}
        role="slider"
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromHue(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            setFromHue(e.clientX);
          }
        }}
        className="relative h-3 cursor-pointer touch-none rounded"
        style={{
          background:
            "linear-gradient(to right, #f00 0%, #ff0 16.66%, #0f0 33.33%, #0ff 50%, #00f 66.66%, #f0f 83.33%, #f00 100%)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white"
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 rounded-full border border-line"
          style={{ backgroundColor: value }}
        />
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {value}
        </span>
      </div>
    </div>
  );
}

/* ---------- Sort menu ---------- */

function SortMenu({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (next: SortKey) => void;
}) {
  return (
    <label className="relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card pl-4 pr-3 text-[13px] hover:border-line-strong hover:bg-card-hover">
      <span className="text-muted">Sort:</span>
      <span className="font-medium text-fg">{SORT_LABELS[value]}</span>
      <svg
        aria-hidden
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-faint"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select
        aria-label="Sort labels by"
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="absolute inset-0 w-full cursor-pointer opacity-0"
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

/* ---------- Icons ---------- */

function XIcon({ size = 14, stroke = 2 }: { size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
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
  );
}
