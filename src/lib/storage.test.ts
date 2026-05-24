import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import { safeWrite, subscribeToStorageErrors } from "./storage";

beforeEach(() => {
  localStorage.clear();
  captureException.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeQuotaError(): Error {
  const e = new Error("Quota");
  e.name = "QuotaExceededError";
  return e;
}

describe("safeWrite — happy path", () => {
  it("writes the value to localStorage and returns true", () => {
    expect(safeWrite("simple-todos:test", "hello")).toBe(true);
    expect(localStorage.getItem("simple-todos:test")).toBe("hello");
  });

  it("doesn't notify listeners on success", () => {
    const listener = vi.fn();
    const unsub = subscribeToStorageErrors(listener);
    safeWrite("simple-todos:ok", "x");
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });
});

describe("safeWrite — quota exceeded", () => {
  it("returns false and notifies listeners with 'quota_exceeded'", () => {
    const listener = vi.fn();
    const unsub = subscribeToStorageErrors(listener);
    vi.spyOn(globalThis.localStorage, "setItem").mockImplementation(() => {
      throw makeQuotaError();
    });
    expect(safeWrite("simple-todos:big", "blob")).toBe(false);
    expect(listener).toHaveBeenCalledWith("quota_exceeded", "simple-todos:big");
    unsub();
  });

  it("captures the error to Sentry with area + code + key tags", () => {
    const err = makeQuotaError();
    vi.spyOn(globalThis.localStorage, "setItem").mockImplementation(() => {
      throw err;
    });
    safeWrite("simple-todos:tagged", "blob");
    expect(captureException).toHaveBeenCalledWith(err, {
      tags: {
        area: "storage",
        code: "quota_exceeded",
        key: "simple-todos:tagged",
      },
    });
  });

  it("classifies legacy Safari QUOTA_EXCEEDED_ERR / code 22 as quota_exceeded", () => {
    const listener = vi.fn();
    subscribeToStorageErrors(listener);
    const legacy = Object.assign(new Error("legacy"), {
      code: 22,
      name: "QUOTA_EXCEEDED_ERR",
    });
    vi.spyOn(globalThis.localStorage, "setItem").mockImplementation(() => {
      throw legacy;
    });
    safeWrite("simple-todos:safari", "x");
    expect(listener).toHaveBeenCalledWith(
      "quota_exceeded",
      "simple-todos:safari",
    );
  });
});

describe("safeWrite — other failures", () => {
  it("classifies arbitrary errors as 'unknown' and still reports", () => {
    const listener = vi.fn();
    subscribeToStorageErrors(listener);
    vi.spyOn(globalThis.localStorage, "setItem").mockImplementation(() => {
      throw new Error("disk full or something else");
    });
    expect(safeWrite("simple-todos:weird", "x")).toBe(false);
    expect(listener).toHaveBeenCalledWith("unknown", "simple-todos:weird");
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ code: "unknown" }),
      }),
    );
  });
});

describe("subscribeToStorageErrors — lifecycle", () => {
  it("unsubscribe stops the listener from firing", () => {
    const listener = vi.fn();
    const unsub = subscribeToStorageErrors(listener);
    unsub();
    vi.spyOn(globalThis.localStorage, "setItem").mockImplementation(() => {
      throw makeQuotaError();
    });
    safeWrite("simple-todos:gone", "x");
    expect(listener).not.toHaveBeenCalled();
  });

  it("fans out to multiple subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeToStorageErrors(a);
    subscribeToStorageErrors(b);
    vi.spyOn(globalThis.localStorage, "setItem").mockImplementation(() => {
      throw makeQuotaError();
    });
    safeWrite("simple-todos:fan", "x");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
