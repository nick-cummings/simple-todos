import type { CSSProperties } from "react";

import {
  DEFAULT_COLOR,
  findLabelByName,
  type Label,
  type LabelColor,
  swatchFor,
} from "./labels";

/**
 * Style helpers that look up a label's color from the registry so
 * pills and filter dots match whatever the user chose in the Labels
 * manager. If a label string isn't in the registry, we fall back to
 * the default named color (gray).
 */

/** Inline style for a filter-chip leading dot. */
export function tagDotStyle(
  labelName: string,
  registry: Label[],
): CSSProperties {
  return { backgroundColor: swatchFor(resolveColor(labelName, registry)).fg };
}

/** Inline style for a tag pill (foreground + tinted background). */
export function tagPillStyle(
  labelName: string,
  registry: Label[],
): CSSProperties {
  const s = swatchFor(resolveColor(labelName, registry));
  return { backgroundColor: s.bg, color: s.fg };
}

function resolveColor(
  labelName: string,
  registry: Label[],
): LabelColor {
  const found = findLabelByName(registry, labelName);
  return found ? found.color : DEFAULT_COLOR;
}
