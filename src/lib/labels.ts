import type { CSSProperties } from "react";

export type NamedColor =
  | "gray"
  | "red"
  | "orange"
  | "amber"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink";

// A label's color is either one of the named swatches above or a raw
// hex string (#RRGGBB) chosen via the custom color picker.
export type LabelColor = NamedColor | string;

export type Label = {
  name: string;
  color: LabelColor;
  createdAt: number;
};

export const LABELS_STORAGE_KEY = "simple-todos:labels:v1";

export const SWATCHES: Record<NamedColor, { fg: string; bg: string }> = {
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

export const NAMED_COLORS: NamedColor[] = Object.keys(SWATCHES) as NamedColor[];

export function isNamedColor(color: LabelColor): color is NamedColor {
  return typeof color === "string" && color in SWATCHES;
}

export function swatchFor(color: LabelColor): { fg: string; bg: string } {
  if (isNamedColor(color)) return SWATCHES[color];
  return { fg: color, bg: hexToTintedBg(color) };
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
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

export function hsvToHex(h: number, s: number, v: number): string {
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

export function hexToTintedBg(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "rgb(127 127 127 / 0.12)";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "rgb(127 127 127 / 0.12)";
  return `rgb(${r} ${g} ${b} / 0.12)`;
}

export const DEFAULT_COLOR: NamedColor = "gray";

/** Inline style for a tag pill (foreground + tinted background). */
export function tagPillStyle(color: LabelColor): CSSProperties {
  const s = swatchFor(color);
  return { color: s.fg, backgroundColor: s.bg };
}

/** Inline style for a filter-chip leading dot. */
export function tagDotStyle(color: LabelColor): CSSProperties {
  return { backgroundColor: swatchFor(color).fg };
}

export function normalizeLabelName(raw: string): string {
  // Trim and collapse whitespace, but preserve casing — uniqueness is
  // enforced case-insensitively (see findLabelByName).
  return raw.trim().replace(/\s+/g, " ");
}

export function findLabelByName(
  labels: Label[],
  name: string,
): Label | undefined {
  const key = name.toLowerCase();
  return labels.find((l) => l.name.toLowerCase() === key);
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

export function loadLabels(): Label[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LABELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLabel);
  } catch {
    return [];
  }
}

export function saveLabels(labels: Label[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(labels));
}

/**
 * One-shot migration that derives label records from any label
 * strings present on existing todos. Used when the labels store
 * hasn't been written yet but the todos store has data from before
 * labels had color metadata.
 */
export function migrateLabelsFromTodos(
  todoLabels: string[][],
): Label[] {
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
        name: trimmed,
        color: DEFAULT_COLOR,
        createdAt: stamp++,
      });
    }
  }
  return [...seen.values()];
}
