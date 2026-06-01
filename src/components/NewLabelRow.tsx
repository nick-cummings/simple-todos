"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
    DEFAULT_COLOR,
    hexToHsv,
    hsvToHex,
    isNamedColor,
    type LabelColor,
    NAMED_COLORS,
    SWATCHES,
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
    onNameChange,
    placeholder = "New label name…",
}: {
    existingNames: Set<string>;
    onAdd: (name: string, color: LabelColor) => void;
    onNameChange?: (name: string) => void;
    placeholder?: string;
}) {
    const [name, setName] = useState("");
    const [color, setColor] = useState<LabelColor>(DEFAULT_COLOR);

    function updateName(next: string) {
        setName(next);
        onNameChange?.(next);
    }

    function submit() {
        const trimmed = name.trim().replaceAll(/\s+/g, " ");
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
                ariaLabel="Label color"
                onChange={setColor}
                value={color}
            />
            <input
                className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-card px-3 text-sm placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis"
                onChange={(e) => {
                    updateName(e.target.value);
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        submit();
                    }
                }}
                placeholder={placeholder}
                value={name}
            />
            <button
                className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-40 active:scale-[0.98]"
                disabled={!name.trim()}
                onClick={submit}
                type="button"
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
    ariaLabel,
    onChange,
    size = "md",
    value,
}: {
    ariaLabel: string;
    onChange: (c: LabelColor) => void;
    size?: "md" | "sm";
    value: LabelColor;
}) {
    const [open, setOpen] = useState(false);
    // Anchor by `bottom` (distance from viewport bottom) rather than
    // `top + translateY(-100%)`. The pop-in animation's keyframes end at
    // `transform: scale(1) translateY(0)`, which overrides any inline
    // translateY after the animation finishes — leaving the popover
    // positioned at its top edge instead of growing upward from its
    // bottom edge. `bottom` sidesteps the conflict entirely.
    const [anchor, setAnchor] = useState<null | {
        bottom: number;
        left: number;
    }>(null);
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
            bottom: window.innerHeight - rect.top + 8,
            left: rect.left,
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
            if (target.closest("[data-picker-portal]")) return;
            setOpen(false);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        globalThis.addEventListener("mousedown", onDown);
        globalThis.addEventListener("keydown", onKey);
        return () => {
            globalThis.removeEventListener("mousedown", onDown);
            globalThis.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const buttonClass = size === "sm" ? "h-9 w-9" : "h-10 w-10";
    const dotClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

    return (
        <>
            <button
                aria-expanded={open}
                aria-label={ariaLabel}
                className={`flex shrink-0 items-center justify-center rounded-lg border border-line-strong bg-card hover:border-line-emphasis hover:bg-card-hover ${
                    buttonClass
                }`}
                onClick={togglePopover}
                ref={triggerRef}
                type="button"
            >
                <span
                    aria-hidden
                    className={`block rounded-full border border-line ${dotClass}`}
                    style={{ background: swatchFor(value).fg }}
                />
            </button>
            {open &&
                anchor &&
                createPortal(
                    <div
                        aria-label={`${ariaLabel} options`}
                        className="fixed z-[60] w-max rounded-lg border border-line bg-card p-2.5 shadow-pop animate-pop-in"
                        data-picker-portal="inline"
                        ref={popoverRef}
                        role="dialog"
                        style={{
                            bottom: anchor.bottom,
                            left: anchor.left,
                        }}
                    >
                        <SwatchRow
                            ariaPrefix={ariaLabel}
                            onChange={(c) => {
                                onChange(c);
                                if (isNamedColor(c)) setOpen(false);
                            }}
                            value={value}
                        />
                    </div>,
                    document.body,
                )}
        </>
    );
}

/* ---------- Swatch picker ---------- */

function CustomColorPicker({
    onChange,
    value,
}: {
    onChange: (hex: string) => void;
    value: string;
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
                aria-label="Saturation and brightness"
                className="relative h-28 cursor-crosshair touch-none rounded"
                onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setFromPad(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        setFromPad(e.clientX, e.clientY);
                    }
                }}
                ref={padRef}
                role="application"
                style={{
                    background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`,
                }}
            >
                <span
                    aria-hidden
                    className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                    style={{
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
                        left: `${hsv.s * 100}%`,
                        top: `${(1 - hsv.v) * 100}%`,
                    }}
                />
            </div>
            <div
                aria-label="Hue"
                aria-valuemax={360}
                aria-valuemin={0}
                aria-valuenow={Math.round(hsv.h)}
                className="relative h-3 cursor-pointer touch-none rounded"
                onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setFromHue(e.clientX);
                }}
                onPointerMove={(e) => {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        setFromHue(e.clientX);
                    }
                }}
                ref={hueRef}
                role="slider"
                style={{
                    background:
                        "linear-gradient(to right, #f00 0%, #ff0 16.66%, #0f0 33.33%, #0ff 50%, #00f 66.66%, #f0f 83.33%, #f00 100%)",
                }}
            >
                <span
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white"
                    style={{
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
                        left: `${(hsv.h / 360) * 100}%`,
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

function CustomSwatch({
    active,
    ariaLabel,
    onChange,
    value,
}: {
    active: boolean;
    ariaLabel: string;
    onChange: (c: LabelColor) => void;
    value: string;
}) {
    const [open, setOpen] = useState(false);
    // See InlineColorPicker for why we anchor by bottom rather than
    // top + translateY — same animate-pop-in conflict.
    const [anchor, setAnchor] = useState<null | {
        bottom: number;
        right: number;
    }>(null);
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
            bottom: window.innerHeight - rect.top + 8,
            right: window.innerWidth - rect.right,
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
        globalThis.addEventListener("mousedown", onDown);
        globalThis.addEventListener("keydown", onKey);
        return () => {
            globalThis.removeEventListener("mousedown", onDown);
            globalThis.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <>
            <button
                aria-expanded={open}
                aria-label={ariaLabel}
                aria-pressed={active}
                className={`relative inline-flex h-5 w-5 items-center justify-center rounded-full border transition-transform active:scale-90 ${
                    active
                        ? "border-fg ring-2 ring-offset-2 ring-offset-card"
                        : "border-line hover:scale-110"
                }`}
                onClick={togglePopover}
                ref={triggerRef}
                style={{
                    // @ts-expect-error CSS custom property used by the ring
                    "--tw-ring-color": active ? value : "var(--fg)",
                    background: active ? value : RAINBOW_GRADIENT,
                }}
                type="button"
            >
                {!active && (
                    <span
                        aria-hidden
                        className="pointer-events-none flex h-2.5 w-2.5 items-center justify-center rounded-full bg-card text-fg"
                    >
                        <svg
                            fill="none"
                            height="7"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="3.5"
                            viewBox="0 0 24 24"
                            width="7"
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
                        aria-label={`${ariaLabel} picker`}
                        className="fixed z-[70] rounded-lg border border-line bg-card p-2.5 shadow-pop animate-pop-in"
                        data-picker-portal="custom"
                        ref={popoverRef}
                        role="dialog"
                        style={{
                            bottom: anchor.bottom,
                            right: anchor.right,
                        }}
                    >
                        <CustomColorPicker
                            onChange={onChange}
                            value={
                                active && /^#[0-9a-fA-F]{6}$/.test(value)
                                    ? value
                                    : "#FF4D4D"
                            }
                        />
                    </div>,
                    document.body,
                )}
        </>
    );
}

function SwatchRow({
    ariaPrefix,
    onChange,
    value,
}: {
    ariaPrefix: string;
    onChange: (c: LabelColor) => void;
    value: LabelColor;
}) {
    const isCustom = !isNamedColor(value);
    return (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
            {NAMED_COLORS.map((k) => {
                const active = k === value;
                return (
                    <button
                        aria-label={`${ariaPrefix}: ${k}`}
                        aria-pressed={active}
                        className={`h-5 w-5 rounded-full border transition-transform active:scale-90 ${
                            active
                                ? "border-fg ring-2 ring-offset-2 ring-offset-card"
                                : "border-line hover:scale-110"
                        }`}
                        key={k}
                        onClick={() => {
                            onChange(k);
                        }}
                        style={{
                            // @ts-expect-error CSS custom property used by the ring
                            "--tw-ring-color": SWATCHES[k].fg,
                            backgroundColor: SWATCHES[k].fg,
                        }}
                        type="button"
                    />
                );
            })}
            <CustomSwatch
                active={isCustom}
                ariaLabel={`${ariaPrefix}: custom`}
                onChange={onChange}
                value={isCustom ? value : "#7c7c7c"}
            />
        </div>
    );
}
