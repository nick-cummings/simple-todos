import { describe, expect, it } from "vitest";

import {
  buildUserMessage,
  GENERATE_DESCRIPTION_SYSTEM_PROMPT,
  isValidLocation,
} from "./generateDescription";

describe("buildUserMessage", () => {
  it("formats title alone when no location is given", () => {
    expect(buildUserMessage({ title: "buy milk" })).toBe("Title: buy milk");
  });
  it("trims the title", () => {
    expect(buildUserMessage({ title: "   buy milk   " })).toBe(
      "Title: buy milk",
    );
  });
  it("includes the location with 4-decimal precision when given", () => {
    expect(
      buildUserMessage({
        location: { latitude: 40.7128, longitude: -74.006 },
        title: "find a coffee shop",
      }),
    ).toBe(
      "Title: find a coffee shop\nApproximate location: 40.7128, -74.0060",
    );
  });
  it("rounds to 4 decimals when given more precise coords", () => {
    expect(
      buildUserMessage({
        location: { latitude: 40.712_828, longitude: -74.006_123 },
        title: "x",
      }),
    ).toBe("Title: x\nApproximate location: 40.7128, -74.0061");
  });
});

describe("isValidLocation", () => {
  it("accepts a well-formed location", () => {
    expect(isValidLocation({ latitude: 40.7128, longitude: -74.006 })).toBe(
      true,
    );
  });
  it("accepts boundaries (±90, ±180)", () => {
    expect(isValidLocation({ latitude: 90, longitude: 180 })).toBe(true);
    expect(isValidLocation({ latitude: -90, longitude: -180 })).toBe(true);
  });
  it("rejects out-of-range latitude", () => {
    expect(isValidLocation({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidLocation({ latitude: -91, longitude: 0 })).toBe(false);
  });
  it("rejects out-of-range longitude", () => {
    expect(isValidLocation({ latitude: 0, longitude: 181 })).toBe(false);
    expect(isValidLocation({ latitude: 0, longitude: -181 })).toBe(false);
  });
  it("rejects NaN / Infinity", () => {
    expect(isValidLocation({ latitude: Number.NaN, longitude: 0 })).toBe(false);
    expect(isValidLocation({ latitude: 0, longitude: Infinity })).toBe(false);
  });
  it("rejects wrong shapes", () => {
    expect(isValidLocation(null)).toBe(false);
    expect(isValidLocation(undefined)).toBe(false);
    expect(isValidLocation({})).toBe(false);
    expect(isValidLocation({ latitude: "40", longitude: -74 })).toBe(false);
    expect(isValidLocation("not an object")).toBe(false);
  });
});

describe("GENERATE_DESCRIPTION_SYSTEM_PROMPT (snapshot)", () => {
  // Pin the prompt. Unintentional edits surface as a snapshot diff so we
  // know to re-test injection / output quality before accepting. Run
  // `vitest -u` to accept new snapshots.
  it("matches snapshot", () => {
    expect(GENERATE_DESCRIPTION_SYSTEM_PROMPT).toMatchSnapshot();
  });
});
