import { describe, expect, it } from "vitest";

import { makeLabel } from "@/test-utils/factories";

import { SWATCHES } from "./labels";
import { tagDotStyle, tagPillStyle } from "./tagColors";

describe("tagPillStyle", () => {
    it("uses the registered color when label is in registry", () => {
        const registry = [makeLabel({ color: "blue", name: "work" })];
        expect(tagPillStyle("work", registry)).toEqual({
            backgroundColor: SWATCHES.blue.bg,
            color: SWATCHES.blue.fg,
        });
    });
    it("matches the registered color case-insensitively", () => {
        const registry = [makeLabel({ color: "green", name: "Work" })];
        expect(tagPillStyle("WORK", registry)).toEqual({
            backgroundColor: SWATCHES.green.bg,
            color: SWATCHES.green.fg,
        });
    });
    it("falls back to gray when label isn't in registry", () => {
        expect(tagPillStyle("orphan", [])).toEqual({
            backgroundColor: SWATCHES.gray.bg,
            color: SWATCHES.gray.fg,
        });
    });
    it("resolves a hex color when the registry stores one", () => {
        const registry = [makeLabel({ color: "#FF0000", name: "custom" })];
        expect(tagPillStyle("custom", registry)).toEqual({
            backgroundColor: "rgb(255 0 0 / 0.12)",
            color: "#FF0000",
        });
    });
});

describe("tagDotStyle", () => {
    it("returns just the fg as backgroundColor", () => {
        const registry = [makeLabel({ color: "purple", name: "work" })];
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
