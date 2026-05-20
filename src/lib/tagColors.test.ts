import { describe, expect, it } from "vitest";
import { SWATCHES } from "./labels";
import { tagDotStyle, tagPillStyle } from "./tagColors";
import { makeLabel } from "@/test-utils/factories";

describe("tagPillStyle", () => {
  it("uses the registered color when label is in registry", () => {
    const registry = [makeLabel({ name: "work", color: "blue" })];
    expect(tagPillStyle("work", registry)).toEqual({
      color: SWATCHES.blue.fg,
      backgroundColor: SWATCHES.blue.bg,
    });
  });
  it("matches the registered color case-insensitively", () => {
    const registry = [makeLabel({ name: "Work", color: "green" })];
    expect(tagPillStyle("WORK", registry)).toEqual({
      color: SWATCHES.green.fg,
      backgroundColor: SWATCHES.green.bg,
    });
  });
  it("falls back to gray when label isn't in registry", () => {
    expect(tagPillStyle("orphan", [])).toEqual({
      color: SWATCHES.gray.fg,
      backgroundColor: SWATCHES.gray.bg,
    });
  });
  it("resolves a hex color when the registry stores one", () => {
    const registry = [makeLabel({ name: "custom", color: "#FF0000" })];
    expect(tagPillStyle("custom", registry)).toEqual({
      color: "#FF0000",
      backgroundColor: "rgb(255 0 0 / 0.12)",
    });
  });
});

describe("tagDotStyle", () => {
  it("returns just the fg as backgroundColor", () => {
    const registry = [makeLabel({ name: "work", color: "purple" })];
    expect(tagDotStyle("work", registry)).toEqual({
      backgroundColor: SWATCHES.purple.fg,
    });
  });
  it("falls back to gray when label isn't in registry", () => {
    expect(tagDotStyle("orphan", [])).toEqual({
      backgroundColor: SWATCHES.gray.fg,
    });
  });
});
