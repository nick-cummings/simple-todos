"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type LabelColor,
  DEFAULT_COLOR,
  NAMED_COLORS,
  SWATCHES,
  hexToHsv,
  hsvToHex,
  isNamedColor,
  swatchFor,
} from "@/lib/labels";

/**
 * Single-row form for creating a new label. Reused by:
 *   - LabelsManager footer
 *   - TodoModal label section (so labels can be created with a color
 *     choice inline, not just "type and Add with default color")
 *
 * Manages its own name + color state. `onAdd(name, color)` fires when
 * the user clicks Add or presses Enter and the name isn't already in
 * `existingNames`. Optional `onNameChange` lets the parent observe
 * the input for ancillary UI like suggestion chips.
 */
export function NewLabelRow({
  existingNames,
  onAdd,
  placeholder = "New label name…",
  onNameChange,
}: {
  existingNames: Set<string>;
  onAdd: (name: string, color: LabelColor) => void;
  placeholder?: string;
  onNameChange?: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>(DEFAULT_COLOR);

  function updateName(next: string) {
    setName(next);
    onNameChange?.(next);
  }

  function submit() {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) return;
    if (existingNames.has(trimmed.toLowerCase())) return;
    onAdd(trimmed, color);
    setName("");
    setColor(DEFAULT_COLOR);
    onNameChange?.("");
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
        onChange={(e) => updateName(e.target.value)}
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

export function InlineColorPicker({
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
  // Anchor by `bottom` (distance from viewport bottom) rather than
  // `top + translateY(-100%)`. The pop-in animation's keyframes end at
  // `transform: scale(1) translateY(0)`, which overrides any inline
  // translateY after the animation finishes — leaving the popover
  // positioned at its top edge instead of growing upward from its
  // bottom edge. `bottom` sidesteps the conflict entirely.
  const [anchor, setAnchor] = useState<{
    left: number;
    bottom: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function togglePopover() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({
      left: rect.left,
      bottom: window.innerHeight - rect.top + 8,
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Element;
      if (triggerRef.current?.contains(target)) return;
      // Stay open if the click is inside any picker portal — including
      // our own AND a nested CustomSwatch portal (the custom-color
      // picker), since both render to document.body and aren't covered
      // by popoverRef.contains alone.
      if (target.closest?.("[data-picker-portal]")) return;
      setOpen(false);
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

  const buttonClass = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const dotClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={togglePopover}
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
      {open &&
        anchor &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={`${ariaLabel} options`}
            data-picker-portal="inline"
            className="fixed z-[60] w-max rounded-lg border border-line bg-card p-2.5 shadow-pop animate-pop-in"
            style={{
              left: anchor.left,
              bottom: anchor.bottom,
            }}
          >
            <SwatchRow
              value={value}
              onChange={(c) => {
                onChange(c);
                if (isNamedColor(c)) setOpen(false);
              }}
              ariaPrefix={ariaLabel}
            />
          </div>,
          document.body,
        )}
    </>
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
  const isCustom = !isNamedColor(value);
  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-1">
      {NAMED_COLORS.map((k) => {
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
  const [open, setOpen] = useState(false);
  // See InlineColorPicker for why we anchor by bottom rather than
  // top + translateY — same animate-pop-in conflict.
  const [anchor, setAnchor] = useState<{
    right: number;
    bottom: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function togglePopover() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({
      right: window.innerWidth - rect.right,
      bottom: window.innerHeight - rect.top + 8,
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
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
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-pressed={active}
        aria-expanded={open}
        onClick={togglePopover}
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
      {open &&
        anchor &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={`${ariaLabel} picker`}
            data-picker-portal="custom"
            className="fixed z-[70] rounded-lg border border-line bg-card p-2.5 shadow-pop animate-pop-in"
            style={{
              right: anchor.right,
              bottom: anchor.bottom,
            }}
          >
            <CustomColorPicker
              value={
                active && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#FF4D4D"
              }
              onChange={onChange}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

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
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
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
