import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReminderRecord } from "@/lib/pushStore";

const listReminders = vi.fn();
const getSubscription = vi.fn();
const deleteReminder = vi.fn();
const deleteSubscription = vi.fn();
const markReminderSent = vi.fn();
const markSubscriptionUsed = vi.fn();
const sendReminderPush = vi.fn();

vi.mock("@/lib/pushStore", () => ({
  deleteReminder: (...a: unknown[]) => deleteReminder(...a),
  deleteSubscription: (...a: unknown[]) => deleteSubscription(...a),
  getSubscription: (...a: unknown[]) => getSubscription(...a),
  listReminders: (...a: unknown[]) => listReminders(...a),
  markReminderSent: (...a: unknown[]) => markReminderSent(...a),
  markSubscriptionUsed: (...a: unknown[]) => markSubscriptionUsed(...a),
}));

vi.mock("@/lib/webPush", () => ({
  sendReminderPush: (...a: unknown[]) => sendReminderPush(...a),
}));

const { captureMessage } = vi.hoisted(() => ({
  captureMessage: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

const ORIGINAL_ENV = { ...process.env };
const SECRET = "test-cron-secret-32-chars-min-xx";

async function importRoute() {
  vi.resetModules();
  return await import("./route");
}

function makeReminder(over: Partial<ReminderRecord> = {}): ReminderRecord {
  return {
    body: "Due today",
    browserId: "b1",
    fireAt: Date.now() - 60_000,
    id: `r-${Math.random().toString(36).slice(2, 8)}`,
    title: "Take out trash",
    todoId: "t1",
    url: "/?todo=t1",
    ...over,
  };
}

function makeRequest(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers.Authorization = authHeader;
  return new Request("http://localhost/api/push/notify-cron", { headers });
}

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    CRON_SECRET: SECRET,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub",
    UPSTASH_REDIS_REST_TOKEN: "tok",
    UPSTASH_REDIS_REST_URL: "https://r",
    VAPID_PRIVATE_KEY: "priv",
    VAPID_SUBJECT: "mailto:o@example.com",
  };
  listReminders.mockReset();
  getSubscription.mockReset();
  deleteReminder.mockReset();
  deleteSubscription.mockReset();
  sendReminderPush.mockReset();
  markReminderSent.mockReset();
  markSubscriptionUsed.mockReset();
  // Default markReminderSent / markSubscriptionUsed to resolve true.
  markReminderSent.mockResolvedValue(true);
  markSubscriptionUsed.mockResolvedValue(true);
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("GET /api/push/notify-cron — auth + config gating", () => {
  it("returns 503 when Upstash env is missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(503);
  });

  it("returns 503 when VAPID env is missing", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(503);
  });

  it("returns 401 with no Authorization header", async () => {
    const { GET } = await importRoute();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 with a wrong bearer", async () => {
    const { GET } = await importRoute();
    const res = await GET(makeRequest("Bearer not-the-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 401 if CRON_SECRET isn't configured at all", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer anything`));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/push/notify-cron — dispatch", () => {
  it("returns an empty summary when there are no reminders", async () => {
    listReminders.mockResolvedValueOnce([]);
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      deduped: 0,
      expired: 0,
      failed: 0,
      sent: 0,
      skipped: 0,
      total: 0,
    });
    expect(sendReminderPush).not.toHaveBeenCalled();
  });

  it("skips reminders whose fireAt is still in the future", async () => {
    listReminders.mockResolvedValueOnce([
      makeReminder({ fireAt: Date.now() + 60_000 }),
    ]);
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    const body = await res.json();
    expect(body).toEqual({
      deduped: 0,
      expired: 0,
      failed: 0,
      sent: 0,
      skipped: 1,
      total: 1,
    });
    expect(sendReminderPush).not.toHaveBeenCalled();
    expect(deleteReminder).not.toHaveBeenCalled();
  });

  it("sends + marks sent + deletes a due reminder when subscription exists", async () => {
    const r = makeReminder({ id: "r1" });
    listReminders.mockResolvedValueOnce([r]);
    getSubscription.mockResolvedValueOnce({
      browserId: "b1",
      createdAt: 0,
      subscription: {
        endpoint: "https://x",
        keys: { auth: "a", p256dh: "p" },
      },
    });
    sendReminderPush.mockResolvedValueOnce({ status: "sent" });
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(sendReminderPush).toHaveBeenCalledTimes(1);
    // markReminderSent fires BEFORE deleteReminder so a crash between
    // the two leaves a recoverable marker for the next cron run.
    expect(markReminderSent).toHaveBeenCalledWith("r1", expect.any(Number));
    expect(deleteReminder).toHaveBeenCalledWith("r1");
    const markedOrder = markReminderSent.mock.invocationCallOrder[0]!;
    const deletedOrder = deleteReminder.mock.invocationCallOrder[0]!;
    expect(markedOrder).toBeLessThan(deletedOrder);
    expect(deleteSubscription).not.toHaveBeenCalled();
    // Subscription is stamped with the delivery timestamp so the GC
    // cron can tell the device is still alive.
    expect(markSubscriptionUsed).toHaveBeenCalledWith("b1", expect.any(Number));
  });

  it("does not stamp the subscription on expired or failed outcomes", async () => {
    listReminders.mockResolvedValueOnce([
      makeReminder({ browserId: "expired-b", id: "r-exp" }),
      makeReminder({ browserId: "failed-b", id: "r-fail" }),
    ]);
    getSubscription
      .mockResolvedValueOnce({
        browserId: "expired-b",
        createdAt: 0,
        subscription: {
          endpoint: "https://x",
          keys: { auth: "a", p256dh: "p" },
        },
      })
      .mockResolvedValueOnce({
        browserId: "failed-b",
        createdAt: 0,
        subscription: {
          endpoint: "https://y",
          keys: { auth: "a", p256dh: "p" },
        },
      });
    sendReminderPush
      .mockResolvedValueOnce({ status: "expired", statusCode: 410 })
      .mockResolvedValueOnce({ status: "failed", statusCode: 500 });
    const { GET } = await importRoute();
    await GET(makeRequest(`Bearer ${SECRET}`));
    expect(markSubscriptionUsed).not.toHaveBeenCalled();
  });

  it("drops both reminder + subscription on 410 expired response", async () => {
    const r = makeReminder({ id: "r2" });
    listReminders.mockResolvedValueOnce([r]);
    getSubscription.mockResolvedValueOnce({
      browserId: "b1",
      createdAt: 0,
      subscription: {
        endpoint: "https://x",
        keys: { auth: "a", p256dh: "p" },
      },
    });
    sendReminderPush.mockResolvedValueOnce({
      status: "expired",
      statusCode: 410,
    });
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    const body = await res.json();
    expect(body.expired).toBe(1);
    expect(deleteReminder).toHaveBeenCalledWith("r2");
    expect(deleteSubscription).toHaveBeenCalledWith("b1");
  });

  it("leaves a failed reminder in place for retry", async () => {
    const r = makeReminder({ id: "r3" });
    listReminders.mockResolvedValueOnce([r]);
    getSubscription.mockResolvedValueOnce({
      browserId: "b1",
      createdAt: 0,
      subscription: {
        endpoint: "https://x",
        keys: { auth: "a", p256dh: "p" },
      },
    });
    sendReminderPush.mockResolvedValueOnce({
      status: "failed",
      statusCode: 500,
    });
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    const body = await res.json();
    expect(body.failed).toBe(1);
    expect(deleteReminder).not.toHaveBeenCalled();
  });

  it("reports a failed delivery to Sentry with reminder context", async () => {
    const r = makeReminder({ id: "r-failed" });
    listReminders.mockResolvedValueOnce([r]);
    getSubscription.mockResolvedValueOnce({
      browserId: "b1",
      createdAt: 0,
      subscription: {
        endpoint: "https://x",
        keys: { auth: "a", p256dh: "p" },
      },
    });
    sendReminderPush.mockResolvedValueOnce({
      status: "failed",
      statusCode: 502,
    });
    const { GET } = await importRoute();
    await GET(makeRequest(`Bearer ${SECRET}`));
    expect(captureMessage).toHaveBeenCalledWith(
      "Web Push delivery failed",
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({
          area: "push-cron",
          reminderId: "r-failed",
          statusCode: 502,
        }),
      }),
    );
  });

  it("deletes orphan reminders whose subscription is missing", async () => {
    const r = makeReminder({ browserId: "gone", id: "r4" });
    listReminders.mockResolvedValueOnce([r]);
    getSubscription.mockResolvedValueOnce(null);
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    const body = await res.json();
    expect(body).toMatchObject({ expired: 0, sent: 0, total: 1 });
    expect(deleteReminder).toHaveBeenCalledWith("r4");
    expect(sendReminderPush).not.toHaveBeenCalled();
  });

  it("caches subscription lookups across multiple reminders for the same browser", async () => {
    const a = makeReminder({ browserId: "b1", id: "r-a" });
    const b = makeReminder({ browserId: "b1", id: "r-b" });
    listReminders.mockResolvedValueOnce([a, b]);
    getSubscription.mockResolvedValue({
      browserId: "b1",
      createdAt: 0,
      subscription: {
        endpoint: "https://x",
        keys: { auth: "a", p256dh: "p" },
      },
    });
    sendReminderPush.mockResolvedValue({ status: "sent" });
    const { GET } = await importRoute();
    await GET(makeRequest(`Bearer ${SECRET}`));
    // Subscription is looked up once even though two reminders fired.
    expect(getSubscription).toHaveBeenCalledTimes(1);
    expect(sendReminderPush).toHaveBeenCalledTimes(2);
  });

  it("does not re-fetch a subscription that was just expired", async () => {
    const a = makeReminder({ browserId: "b1", id: "r-a" });
    const b = makeReminder({ browserId: "b1", id: "r-b" });
    listReminders.mockResolvedValueOnce([a, b]);
    getSubscription.mockResolvedValueOnce({
      browserId: "b1",
      createdAt: 0,
      subscription: {
        endpoint: "https://x",
        keys: { auth: "a", p256dh: "p" },
      },
    });
    sendReminderPush.mockResolvedValueOnce({
      status: "expired",
      statusCode: 410,
    });
    const { GET } = await importRoute();
    await GET(makeRequest(`Bearer ${SECRET}`));
    // r-a expired the subscription; r-b should see a null lookup
    // from the cache and just drop itself.
    expect(getSubscription).toHaveBeenCalledTimes(1);
    expect(sendReminderPush).toHaveBeenCalledTimes(1);
    expect(deleteReminder).toHaveBeenCalledWith("r-a");
    expect(deleteReminder).toHaveBeenCalledWith("r-b");
  });
});

describe("GET /api/push/notify-cron — idempotency", () => {
  it("skips and cleans up a reminder whose sentAt is within the dedupe window", async () => {
    // sentAt is 1 hour ago — well inside the 6h dedupe window.
    const recentlySent = makeReminder({
      id: "r-recent",
      sentAt: Date.now() - 60 * 60 * 1000,
    });
    listReminders.mockResolvedValueOnce([recentlySent]);
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    const body = await res.json();
    expect(body.deduped).toBe(1);
    expect(body.sent).toBe(0);
    expect(sendReminderPush).not.toHaveBeenCalled();
    expect(markReminderSent).not.toHaveBeenCalled();
    // Still deletes the marker so it doesn't accumulate.
    expect(deleteReminder).toHaveBeenCalledWith("r-recent");
    // Never touched the subscription.
    expect(getSubscription).not.toHaveBeenCalled();
  });

  it("re-sends when sentAt is older than the dedupe window", async () => {
    // sentAt is 24 hours ago — past the 6h dedupe window. Treat as
    // a brand new delivery (rare path: cron skipped a run AND the
    // delete failed, so the record outlived its dedupe).
    const stale = makeReminder({
      id: "r-stale",
      sentAt: Date.now() - 24 * 60 * 60 * 1000,
    });
    listReminders.mockResolvedValueOnce([stale]);
    getSubscription.mockResolvedValueOnce({
      browserId: "b1",
      createdAt: 0,
      subscription: {
        endpoint: "https://x",
        keys: { auth: "a", p256dh: "p" },
      },
    });
    sendReminderPush.mockResolvedValueOnce({ status: "sent" });
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    const body = await res.json();
    expect(body.deduped).toBe(0);
    expect(body.sent).toBe(1);
    expect(sendReminderPush).toHaveBeenCalledTimes(1);
  });

  it("does not dedupe a reminder that has never been sent (no sentAt)", async () => {
    const fresh = makeReminder({ id: "r-fresh" });
    expect(fresh.sentAt).toBeUndefined();
    listReminders.mockResolvedValueOnce([fresh]);
    getSubscription.mockResolvedValueOnce({
      browserId: "b1",
      createdAt: 0,
      subscription: {
        endpoint: "https://x",
        keys: { auth: "a", p256dh: "p" },
      },
    });
    sendReminderPush.mockResolvedValueOnce({ status: "sent" });
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    const body = await res.json();
    expect(body.deduped).toBe(0);
    expect(body.sent).toBe(1);
  });

  it("includes a `deduped` counter in the summary", async () => {
    listReminders.mockResolvedValueOnce([]);
    const { GET } = await importRoute();
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    const body = await res.json();
    expect(body).toHaveProperty("deduped", 0);
  });
});
