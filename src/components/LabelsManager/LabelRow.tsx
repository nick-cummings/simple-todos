import { useEffect, useRef, useState } from "react";

import { type Label, type LabelColor, swatchFor } from "@/lib/labels";

import { InlineColorPicker } from "../NewLabelRow";
import { CheckIcon, PencilIcon, TrashIcon } from "./Icons";

export function LabelRow({
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
    globalThis.setTimeout(() => {
      onDelete();
    }, 260);
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
    return () => {
      globalThis.removeEventListener("mousedown", onDown);
    };
  }, [peek]);

  return (
    <div
      className={`relative border-b border-line ${
        exiting
          ? "max-h-0 overflow-hidden opacity-0"
          : "max-h-[120px] overflow-x-clip opacity-100"
      }`}
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
              onChange={(e) => {
                setDraft(e.target.value);
              }}
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
