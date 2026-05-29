import { afterEach, describe, expect, it } from "vitest";

import { mockupsEnabled } from "./mockupsEnabled";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("mockupsEnabled", () => {
  it("is disabled in Vercel production", () => {
    process.env.VERCEL_ENV = "production";
    expect(mockupsEnabled()).toBe(false);
  });

  it("is enabled on Vercel preview deploys", () => {
    process.env.VERCEL_ENV = "preview";
    expect(mockupsEnabled()).toBe(true);
  });

  it("is enabled on Vercel development", () => {
    process.env.VERCEL_ENV = "development";
    expect(mockupsEnabled()).toBe(true);
  });

  it("falls back to NODE_ENV when VERCEL_ENV is unset: disabled in production", () => {
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = "production";
    expect(mockupsEnabled()).toBe(false);
  });

  it("falls back to NODE_ENV when VERCEL_ENV is unset: enabled in development", () => {
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = "development";
    expect(mockupsEnabled()).toBe(true);
  });

  it("prefers VERCEL_ENV over NODE_ENV: enabled on preview even with NODE_ENV=production", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.NODE_ENV = "production";
    expect(mockupsEnabled()).toBe(true);
  });
});
