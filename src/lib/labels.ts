import type { CSSProperties } from "react";

import { isBrowser } from "./runtime";

export interface Label {
  color: LabelColor;
  createdAt: number;
  name: string;
}

// A label's color is either one of the named swatches above or a raw
// hex string (#RRGGBB) chosen via the custom color picker. The
// `(string & {})` keeps the literal union visible in autocomplete; a
// bare `NamedColor | string` would widen to plain `string` and lose
// the hints.
export type LabelColor = NamedColor | (string & {});

export type NamedColor =
  | "amber"
  | "blue"
  | "gray"
  | "green"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "teal";

export const LABELS_STORAGE_KEY = "simple-todos:labels:v1";

export const SWATCHES: Record<NamedColor, { bg: string; fg: string }> = {
  amber: { bg: "rgb(192 138 30 / 0.12)", fg: "#C08A1E" },
  blue: { bg: "rgb(63 134 232 / 0.10)", fg: "#3F86E8" },
  gray: { bg: "rgb(107 114 128 / 0.12)", fg: "#6B7280" },
  green: { bg: "rgb(60 154 95 / 0.12)", fg: "#3C9A5F" },
  orange: { bg: "rgb(226 115 58 / 0.12)", fg: "#E2733A" },
  pink: { bg: "rgb(218 97 160 / 0.10)", fg: "#DA61A0" },
  purple: { bg: "rgb(138 92 240 / 0.12)", fg: "#8A5CF0" },
  red: { bg: "rgb(224 70 79 / 0.10)", fg: "#E0464F" },
  teal: { bg: "rgb(46 146 150 / 0.12)", fg: "#2E9296" },
};

export const NAMED_COLORS: NamedColor[] = Object.keys(SWATCHES) as NamedColor[];

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const c = hex.replace("#", "");
  if (c.length !== 6) return { h: 0, s: 0, v: 0.5 };
  const r = Number.parseInt(c.slice(0, 2), 16) / 255;
  const g = Number.parseInt(c.slice(2, 4), 16) / 255;
  const b = Number.parseInt(c.slice(4, 6), 16) / 255;
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

export function hexToTintedBg(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "rgb(127 127 127 / 0.12)";
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "rgb(127 127 127 / 0.12)";
  return `rgb(${r} ${g} ${b} / 0.12)`;
}

export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function isNamedColor(color: LabelColor): color is NamedColor {
  return typeof color === "string" && color in SWATCHES;
}

export function swatchFor(color: LabelColor): { bg: string; fg: string } {
  if (isNamedColor(color)) return SWATCHES[color];
  return { bg: hexToTintedBg(color), fg: color };
}

export const DEFAULT_COLOR: NamedColor = "gray";

export function findLabelByName(
  labels: Label[],
  name: string,
): Label | undefined {
  const key = name.toLowerCase();
  return labels.find((l) => l.name.toLowerCase() === key);
}

export function loadLabels(): Label[] {
  if (!isBrowser()) return [];
  try {
    const raw = globalThis.localStorage.getItem(LABELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLabel);
  } catch {
    return [];
  }
}

/**
 * One-shot migration that derives label records from any label
 * strings present on existing todos. Used when the labels store
 * hasn't been written yet but the todos store has data from before
 * labels had color metadata.
 */
export function migrateLabelsFromTodos(todoLabels: string[][]): Label[] {
  const seen = new Map<string, Label>();
  const now = Date.now();
  let stamp = now - todoLabels.length;
  for (const labels of todoLabels) {
    for (const name of labels) {
      const trimmed = normalizeLabelName(name);
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.set(key, {
        color: DEFAULT_COLOR,
        createdAt: stamp++,
        name: trimmed,
      });
    }
  }
  return [...seen.values()];
}

export function normalizeLabelName(raw: string): string {
  // Trim and collapse whitespace, but preserve casing — uniqueness is
  // enforced case-insensitively (see findLabelByName).
  return raw.trim().replaceAll(/\s+/g, " ");
}

export function saveLabels(labels: Label[]): void {
  if (!isBrowser()) return;
  globalThis.localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(labels));
}

/** Inline style for a filter-chip leading dot. */
export function tagDotStyle(color: LabelColor): CSSProperties {
  return { backgroundColor: swatchFor(color).fg };
}

/** Inline style for a tag pill (foreground + tinted background). */
export function tagPillStyle(color: LabelColor): CSSProperties {
  const s = swatchFor(color);
  return { backgroundColor: s.bg, color: s.fg };
}

function isLabel(v: unknown): v is Label {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    typeof o.color === "string" &&
    typeof o.createdAt === "number"
  );
}
