import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReminderRecord } from "@/lib/pushStore";

const listReminders = vi.fn();
const getSubscription = vi.fn();
const deleteReminder = vi.fn();
const deleteSubscription = vi.fn();
const sendReminderPush = vi.fn();

vi.mock("@/lib/pushStore", () => ({
  deleteReminder: (...a: unknown[]) => deleteReminder(...a),
  deleteSubscription: (...a: unknown[]) => deleteSubscription(...a),
  getSubscription: (...a: unknown[]) => getSubscription(...a),
  listReminders: (...a: unknown[]) => listReminders(...a),
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
      expired: 0,
      failed: 0,
      sent: 0,
      skipped: 1,
      total: 1,
    });
    expect(sendReminderPush).not.toHaveBeenCalled();
    expect(deleteReminder).not.toHaveBeenCalled();
  });

  it("sends + deletes a due reminder when subscription exists", async () => {
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
    expect(deleteReminder).toHaveBeenCalledWith("r1");
    expect(deleteSubscription).not.toHaveBeenCalled();
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
