import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __setRedisClient,
  deleteReminder,
  deleteSubscription,
  getReminder,
  getSubscription,
  listReminders,
  markReminderSent,
  type PushSubscriptionRecord,
  type ReminderRecord,
  saveReminder,
  saveSubscription,
} from "./pushStore";

// Minimal in-memory Redis stub mirroring the @upstash/redis surface
// that pushStore uses (get/set/del/scan/mget). Returns parsed JSON
// for get because that's what the real client does when the stored
// value parses as JSON.
function makeFakeRedis() {
  const store = new Map<string, string>();
  const calls = {
    del: vi.fn(),
    get: vi.fn(),
    mget: vi.fn(),
    scan: vi.fn(),
    set: vi.fn(),
  };
  return {
    calls,
    client: {
      async del(key: string) {
        calls.del(key);
        store.delete(key);
      },
      async get(key: string) {
        calls.get(key);
        const v = store.get(key);
        if (v === undefined) return null;
        try {
          return JSON.parse(v) as unknown;
        } catch {
          return v;
        }
      },
      async mget(...keys: string[]) {
        calls.mget(...keys);
        return keys.map((k) => {
          const v = store.get(k);
          if (v === undefined) return null;
          try {
            return JSON.parse(v) as unknown;
          } catch {
            return v;
          }
        });
      },
      async scan(
        _cursor: number | string,
        opts: { count: number; match: string },
      ) {
        calls.scan(_cursor, opts);
        const pattern = opts.match.replace(/\*$/, "");
        const matched = [...store.keys()].filter((k) => k.startsWith(pattern));
        return [0, matched] as const;
      },
      async set(key: string, value: string) {
        calls.set(key, value);
        store.set(key, value);
      },
    },
    store,
  };
}

let fake: ReturnType<typeof makeFakeRedis>;

beforeEach(() => {
  fake = makeFakeRedis();
  // The cast is fine for tests — pushStore only uses the methods we
  // stub above.
  __setRedisClient(fake.client as unknown as never);
});

afterEach(() => {
  __setRedisClient(null);
});

const SUB: PushSubscriptionRecord = {
  browserId: "b1",
  createdAt: 1_700_000_000_000,
  subscription: {
    endpoint: "https://example.com/push/abc",
    keys: { auth: "auth", p256dh: "p256" },
  },
};

const REMINDER: ReminderRecord = {
  body: "Body",
  browserId: "b1",
  fireAt: 1_700_000_000_000,
  id: "r1",
  title: "Title",
  todoId: "t1",
  url: "/?todo=t1",
};

describe("pushStore getClient (lazy init)", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("throws when Upstash env vars are missing on the first call", async () => {
    __setRedisClient(null);
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    await expect(saveSubscription(SUB)).rejects.toThrow(
      /UPSTASH_REDIS_REST_URL/,
    );
  });
});

describe("pushStore subscriptions", () => {
  it("saves + retrieves a subscription by browserId", async () => {
    await saveSubscription(SUB);
    const got = await getSubscription("b1");
    expect(got).toEqual(SUB);
    expect(fake.calls.set).toHaveBeenCalledWith(
      "subscription:b1",
      JSON.stringify(SUB),
    );
  });

  it("returns null when no subscription exists", async () => {
    expect(await getSubscription("missing")).toBeNull();
  });

  it("deletes a subscription", async () => {
    await saveSubscription(SUB);
    await deleteSubscription("b1");
    expect(await getSubscription("b1")).toBeNull();
    expect(fake.calls.del).toHaveBeenCalledWith("subscription:b1");
  });

  it("returns the record when Upstash returns a parsed object (auto-decoding)", async () => {
    fake.store.set("subscription:b1", JSON.stringify(SUB));
    expect(await getSubscription("b1")).toEqual(SUB);
  });
});

describe("pushStore reminders", () => {
  it("saves + retrieves a reminder by id", async () => {
    await saveReminder(REMINDER);
    expect(await getReminder("r1")).toEqual(REMINDER);
  });

  it("deletes a reminder", async () => {
    await saveReminder(REMINDER);
    await deleteReminder("r1");
    expect(await getReminder("r1")).toBeNull();
  });

  it("listReminders returns every reminder in storage", async () => {
    await saveReminder(REMINDER);
    await saveReminder({ ...REMINDER, id: "r2", title: "Second" });
    const list = await listReminders();
    expect(list).toHaveLength(2);
    expect(list.map((r) => r.id).toSorted()).toEqual(["r1", "r2"]);
  });

  it("listReminders returns [] when no reminders exist", async () => {
    expect(await listReminders()).toEqual([]);
  });

  it("listReminders skips reminders whose payload won't parse", async () => {
    fake.store.set("reminder:r1", "{not valid json");
    fake.store.set("reminder:r2", JSON.stringify(REMINDER));
    const list = await listReminders();
    expect(list.map((r) => r.id)).toEqual(["r1"]); // mget returns the record from r2 under r1 key match
    // (The point is we get one record back and don't crash.)
  });
});

describe("pushStore markReminderSent", () => {
  it("writes sentAt onto an existing reminder and preserves the rest", async () => {
    await saveReminder(REMINDER);
    const ok = await markReminderSent("r1", 12_345_678);
    expect(ok).toBe(true);
    const after = await getReminder("r1");
    expect(after).toEqual({ ...REMINDER, sentAt: 12_345_678 });
  });

  it("returns false when the reminder has already been deleted", async () => {
    const ok = await markReminderSent("never-existed", Date.now());
    expect(ok).toBe(false);
  });

  it("overwrites a previous sentAt rather than appending", async () => {
    await saveReminder({ ...REMINDER, sentAt: 1 });
    await markReminderSent("r1", 999);
    const after = await getReminder("r1");
    expect(after?.sentAt).toBe(999);
  });
});
