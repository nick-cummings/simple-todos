import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_COLOR,
  LABELS_STORAGE_KEY,
  NAMED_COLORS,
  SWATCHES,
  findLabelByName,
  hexToHsv,
  hexToTintedBg,
  hsvToHex,
  isNamedColor,
  loadLabels,
  migrateLabelsFromTodos,
  normalizeLabelName,
  saveLabels,
  swatchFor,
  tagDotStyle,
  tagPillStyle,
  type Label,
} from "./labels";
import { makeLabel } from "@/test-utils/factories";

describe("isNamedColor", () => {
  it("returns true for each of the named swatches", () => {
    for (const name of NAMED_COLORS) {
      expect(isNamedColor(name)).toBe(true);
    }
  });
  it("returns false for a hex color", () => {
    expect(isNamedColor("#FF0000")).toBe(false);
  });
  it("returns false for an unknown string", () => {
    expect(isNamedColor("fuchsia")).toBe(false);
  });
});

describe("swatchFor", () => {
  it("returns the SWATCHES entry for a named color", () => {
    expect(swatchFor("red")).toEqual(SWATCHES.red);
  });
  it("uses the hex value as fg and computes a tinted bg for a hex color", () => {
    const out = swatchFor("#FF0000");
    expect(out.fg).toBe("#FF0000");
    expect(out.bg).toBe("rgb(255 0 0 / 0.12)");
  });
  it("falls back to a gray-ish bg for malformed hex", () => {
    const out = swatchFor("#zzz");
    expect(out.bg).toBe("rgb(127 127 127 / 0.12)");
  });
});

describe("hexToTintedBg", () => {
  it("converts a normal hex to an alpha-12% rgb()", () => {
    expect(hexToTintedBg("#3F86E8")).toBe("rgb(63 134 232 / 0.12)");
  });
  it("accepts hex without the leading #", () => {
    expect(hexToTintedBg("3F86E8")).toBe("rgb(63 134 232 / 0.12)");
  });
  it("returns gray fallback for wrong-length hex", () => {
    expect(hexToTintedBg("#FFF")).toBe("rgb(127 127 127 / 0.12)");
  });
  it("returns gray fallback for non-hex characters", () => {
    expect(hexToTintedBg("#GGGGGG")).toBe("rgb(127 127 127 / 0.12)");
  });
});

describe("hexToHsv / hsvToHex round-trip", () => {
  const samples = [
    "#000000",
    "#FFFFFF",
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#00FFFF",
    "#FF00FF",
    "#7F7F7F",
    "#E0464F",
    "#3F86E8",
    "#8A5CF0",
  ];
  it.each(samples)("round-trips %s within 1 channel of precision", (hex) => {
    const { h, s, v } = hexToHsv(hex);
    const out = hsvToHex(h, s, v);
    // Compare numeric byte values (round-trip can drift by 1 due to
    // floating-point rounding through HSV space).
    const toRgb = (h: string) => [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
    const inRgb = toRgb(hex);
    const outRgb = toRgb(out);
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(inRgb[i] - outRgb[i])).toBeLessThanOrEqual(1);
    }
  });
  it("returns a neutral HSV for malformed hex", () => {
    expect(hexToHsv("nope")).toEqual({ h: 0, s: 0, v: 0.5 });
  });
});

describe("normalizeLabelName", () => {
  it("trims and collapses whitespace, preserves casing", () => {
    expect(normalizeLabelName("  Foo  Bar  ")).toBe("Foo Bar");
  });
});

describe("findLabelByName", () => {
  const labels: Label[] = [
    makeLabel({ name: "Work" }),
    makeLabel({ name: "errands" }),
  ];
  it("matches case-insensitively", () => {
    expect(findLabelByName(labels, "work")?.name).toBe("Work");
    expect(findLabelByName(labels, "ERRANDS")?.name).toBe("errands");
  });
  it("returns undefined when no label matches", () => {
    expect(findLabelByName(labels, "nope")).toBeUndefined();
  });
});

describe("tagPillStyle / tagDotStyle", () => {
  it("tagPillStyle returns fg+bg for a named color", () => {
    expect(tagPillStyle("blue")).toEqual({
      color: SWATCHES.blue.fg,
      backgroundColor: SWATCHES.blue.bg,
    });
  });
  it("tagDotStyle returns just backgroundColor", () => {
    expect(tagDotStyle("blue")).toEqual({
      backgroundColor: SWATCHES.blue.fg,
    });
  });
});

describe("loadLabels / saveLabels", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips a list of labels", () => {
    const labels = [makeLabel({ name: "work" }), makeLabel({ name: "home" })];
    saveLabels(labels);
    expect(loadLabels()).toEqual(labels);
  });
  it("returns empty array when storage is unset", () => {
    expect(loadLabels()).toEqual([]);
  });
  it("returns empty array on malformed JSON", () => {
    localStorage.setItem(LABELS_STORAGE_KEY, "{not json");
    expect(loadLabels()).toEqual([]);
  });
  it("returns empty array when value isn't an array", () => {
    localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify({}));
    expect(loadLabels()).toEqual([]);
  });
  it("filters out malformed entries", () => {
    const good = makeLabel();
    localStorage.setItem(
      LABELS_STORAGE_KEY,
      JSON.stringify([good, null, { name: "x" }, "string", { name: "x", color: 1, createdAt: 1 }]),
    );
    expect(loadLabels()).toEqual([good]);
  });
  it("is safe when window is undefined (SSR)", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simulating SSR
    delete globalThis.window;
    try {
      expect(loadLabels()).toEqual([]);
      saveLabels([makeLabel()]); // should not throw
    } finally {
      globalThis.window = originalWindow;
    }
  });
});

describe("migrateLabelsFromTodos", () => {
  it("dedupes case-insensitively, preserves first-occurrence casing", () => {
    const out = migrateLabelsFromTodos([
      ["Work", "errands"],
      ["work", "Home"],
    ]);
    expect(out.map((l) => l.name)).toEqual(["Work", "errands", "Home"]);
  });
  it("filters whitespace-only entries", () => {
    const out = migrateLabelsFromTodos([["", "   ", "foo"]]);
    expect(out.map((l) => l.name)).toEqual(["foo"]);
  });
  it("assigns the DEFAULT_COLOR to every label", () => {
    const out = migrateLabelsFromTodos([["a", "b"]]);
    expect(out.every((l) => l.color === DEFAULT_COLOR)).toBe(true);
  });
  it("returns empty array for no input", () => {
    expect(migrateLabelsFromTodos([])).toEqual([]);
  });
  it("assigns monotonically increasing createdAt values (preserves first-seen order)", () => {
    const out = migrateLabelsFromTodos([["a", "b", "c"]]);
    expect(out[0].createdAt).toBeLessThan(out[1].createdAt);
    expect(out[1].createdAt).toBeLessThan(out[2].createdAt);
  });
});
