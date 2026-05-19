import type { CSSProperties } from "react";
import {
  type Label,
  type LabelColor,
  DEFAULT_COLOR,
  findLabelByName,
  swatchFor,
} from "./labels";

/**
 * Style helpers that look up a label's color from the registry so
 * pills and filter dots match whatever the user chose in the Labels
 * manager. If a label string isn't in the registry, we fall back to
 * the default named color (gray).
 */

function resolveColor(
  labelName: string,
  registry: Label[],
): LabelColor {
  const found = findLabelByName(registry, labelName);
  return found ? found.color : DEFAULT_COLOR;
}

/** Inline style for a tag pill (foreground + tinted background). */
export function tagPillStyle(
  labelName: string,
  registry: Label[],
): CSSProperties {
  const s = swatchFor(resolveColor(labelName, registry));
  return { color: s.fg, backgroundColor: s.bg };
}

/** Inline style for a filter-chip leading dot. */
export function tagDotStyle(
  labelName: string,
  registry: Label[],
): CSSProperties {
  return { backgroundColor: swatchFor(resolveColor(labelName, registry)).fg };
}
