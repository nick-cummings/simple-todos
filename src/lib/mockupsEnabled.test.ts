import { afterEach, describe, expect, it, vi } from "vitest";

import { mockupsEnabled } from "./mockupsEnabled";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mockupsEnabled", () => {
  it("is disabled in Vercel production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(mockupsEnabled()).toBe(false);
  });

  it("is enabled on Vercel preview deploys", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(mockupsEnabled()).toBe(true);
  });

  it("is enabled on Vercel development", () => {
    vi.stubEnv("VERCEL_ENV", "development");
    expect(mockupsEnabled()).toBe(true);
  });

  it("falls back to NODE_ENV when VERCEL_ENV is unset: disabled in production", () => {
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("NODE_ENV", "production");
    expect(mockupsEnabled()).toBe(false);
  });

  it("falls back to NODE_ENV when VERCEL_ENV is unset: enabled in development", () => {
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("NODE_ENV", "development");
    expect(mockupsEnabled()).toBe(true);
  });

  it("prefers VERCEL_ENV over NODE_ENV: enabled on preview even with NODE_ENV=production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production");
    expect(mockupsEnabled()).toBe(true);
  });
});
