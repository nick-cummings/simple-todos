import { act, renderHook } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Reactive in-memory URL store so renderHook re-renders when
// router.replace fires. Mirrors the real Next.js navigation contract
// closely enough that the hook's URL ↔ state round-trip is the
// behavior under test.
let storeParams = new URLSearchParams();
const subscribers = new Set<() => void>();
function emit() {
  for (const fn of subscribers) fn();
}
function snapshot() {
  return storeParams;
}
function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

const mockReplace = vi.fn((href: string) => {
  const queryStart = href.indexOf("?");
  storeParams =
    queryStart === -1
      ? new URLSearchParams()
      : new URLSearchParams(href.slice(queryStart + 1));
  emit();
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () =>
    useSyncExternalStore(subscribe, snapshot, snapshot),
}));

async function importHook() {
  vi.resetModules();
  const mod = await import("./useFilterParams");
  return mod.useFilterParams;
}

beforeEach(() => {
  storeParams = new URLSearchParams();
  mockReplace.mockClear();
  emit();
});

describe("useFilterParams — defaults", () => {
  it("yields the expected defaults when no params are present", async () => {
    const useFilterParams = await importHook();
    const { result } = renderHook(() => useFilterParams());
    expect(result.current.query).toBe("");
    expect(result.current.sort).toBe("createdDesc");
    expect(result.current.activeLabels).toEqual([]);
    expect([...result.current.activeStatuses]).toEqual(["open"]);
  });

  it("parses values when params are pre-populated", async () => {
    storeParams = new URLSearchParams("q=mail&sort=titleAsc&l=work,urgent&s=done");
    const useFilterParams = await importHook();
    const { result } = renderHook(() => useFilterParams());
    expect(result.current.query).toBe("mail");
    expect(result.current.sort).toBe("titleAsc");
    expect(result.current.activeLabels).toEqual(["work", "urgent"]);
    expect([...result.current.activeStatuses]).toEqual(["done"]);
  });

  it("falls back to defaults for an unknown sort value", async () => {
    storeParams = new URLSearchParams("sort=bogus");
    const useFilterParams = await importHook();
    const { result } = renderHook(() => useFilterParams());
    expect(result.current.sort).toBe("createdDesc");
  });

  it("drops unknown status tokens but keeps valid ones", async () => {
    storeParams = new URLSearchParams("s=open,bogus,done");
    const useFilterParams = await importHook();
    const { result } = renderHook(() => useFilterParams());
    expect([...result.current.activeStatuses].toSorted()).toEqual([
      "done",
      "open",
    ]);
  });

  it("treats an explicit empty `s` as 'show nothing', not as default", async () => {
    storeParams = new URLSearchParams("s=");
    const useFilterParams = await importHook();
    const { result } = renderHook(() => useFilterParams());
    expect([...result.current.activeStatuses]).toEqual([]);
  });
});

describe("useFilterParams — setters", () => {
  it("setQuery writes ?q= and clearing it removes the param", async () => {
    const useFilterParams = await importHook();
    const { result } = renderHook(() => useFilterParams());
    act(() => {
      result.current.setQuery("hello");
    });
    expect(storeParams.get("q")).toBe("hello");
    expect(result.current.query).toBe("hello");
    act(() => {
      result.current.setQuery("");
    });
    expect(storeParams.get("q")).toBeNull();
  });

  it("setActiveLabels joins on comma and clears when empty", async () => {
    const useFilterParams = await importHook();
    const { result } = renderHook(() => useFilterParams());
    act(() => {
      result.current.setActiveLabels(["work", "urgent"]);
    });
    expect(storeParams.get("l")).toBe("work,urgent");
    act(() => {
      result.current.setActiveLabels([]);
    });
    expect(storeParams.get("l")).toBeNull();
  });

  it("setSort omits the default and writes non-defaults", async () => {
    const useFilterParams = await importHook();
    const { result } = renderHook(() => useFilterParams());
    act(() => {
      result.current.setSort("titleAsc");
    });
    expect(storeParams.get("sort")).toBe("titleAsc");
    act(() => {
      result.current.setSort("createdDesc");
    });
    expect(storeParams.get("sort")).toBeNull();
  });

  it("setActiveStatuses omits when default, encodes explicit empty as ''", async () => {
    const useFilterParams = await importHook();
    const { result } = renderHook(() => useFilterParams());
    // Default → no param.
    act(() => {
      result.current.setActiveStatuses(new Set(["open"]));
    });
    expect(storeParams.has("s")).toBe(false);
    // Non-default → comma-joined.
    act(() => {
      result.current.setActiveStatuses(new Set(["done"]));
    });
    expect(storeParams.get("s")).toBe("done");
    // Explicit empty → "" (preserved, not deleted).
    act(() => {
      result.current.setActiveStatuses(new Set());
    });
    expect(storeParams.has("s")).toBe(true);
    expect(storeParams.get("s")).toBe("");
    expect([...result.current.activeStatuses]).toEqual([]);
  });

  it("preserves unrelated params (e.g. ?todo=) when updating filters", async () => {
    storeParams = new URLSearchParams("todo=abc");
    emit();
    const useFilterParams = await importHook();
    const { result } = renderHook(() => useFilterParams());
    act(() => {
      result.current.setQuery("hello");
    });
    expect(storeParams.get("todo")).toBe("abc");
    expect(storeParams.get("q")).toBe("hello");
  });
});
