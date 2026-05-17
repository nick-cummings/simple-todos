import type { CSSProperties } from "react";

export type KnownTag = "bill" | "dinner" | "judith" | "subscription";

export const KNOWN_TAGS: ReadonlyArray<KnownTag> = [
  "bill",
  "dinner",
  "judith",
  "subscription",
];

function isKnown(tag: string): tag is KnownTag {
  return (KNOWN_TAGS as readonly string[]).includes(tag);
}

/** Inline style for a tag pill (foreground + tinted background). */
export function tagPillStyle(tag: string): CSSProperties {
  if (isKnown(tag)) {
    return {
      color: `var(--tag-${tag}-fg)`,
      backgroundColor: `var(--tag-${tag}-bg)`,
    };
  }
  return {
    color: "var(--muted)",
    backgroundColor: "var(--subtle)",
  };
}

/** Inline style for a filter-chip leading dot. */
export function tagDotStyle(tag: string): CSSProperties {
  if (isKnown(tag)) {
    return { backgroundColor: `var(--tag-${tag}-fg)` };
  }
  return { backgroundColor: "var(--faint)" };
}

/** Class name for an unknown tag pill's bg/text (falls back to subtle). */
export function tagPillFallbackClass(tag: string): string {
  return isKnown(tag) ? "" : "bg-subtle text-muted";
}
