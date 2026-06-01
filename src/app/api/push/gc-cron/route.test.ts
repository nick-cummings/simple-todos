import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PushSubscriptionRecord } from "@/lib/pushStore";

const listSubscriptions = vi.fn();
const deleteSubscription = vi.fn();

vi.mock("@/lib/pushStore", () => ({
    deleteSubscription: (...a: unknown[]) => deleteSubscription(...a),
    listSubscriptions: (...a: unknown[]) => listSubscriptions(...a),
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

function makeRequest(authHeader?: string) {
    const headers: Record<string, string> = {};
    if (authHeader !== undefined) headers.Authorization = authHeader;
    return new Request("http://localhost/api/push/gc-cron", { headers });
}

function makeSub(
    over: Partial<PushSubscriptionRecord> = {},
): PushSubscriptionRecord {
    return {
        browserId: `b-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: 0,
        subscription: {
            endpoint: "https://push.example/abc",
            keys: { auth: "a", p256dh: "p" },
        },
        ...over,
    };
}

const ONE_DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
    process.env = {
        ...ORIGINAL_ENV,
        CRON_SECRET: SECRET,
        UPSTASH_REDIS_REST_TOKEN: "tok",
        UPSTASH_REDIS_REST_URL: "https://r",
    };
    listSubscriptions.mockReset();
    deleteSubscription.mockReset();
    captureMessage.mockReset();
});

afterEach(() => {
    process.env = ORIGINAL_ENV;
});

describe("GET /api/push/gc-cron — auth + config gating", () => {
    it("returns 503 when Upstash env is missing", async () => {
        delete process.env.UPSTASH_REDIS_REST_URL;
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

describe("GET /api/push/gc-cron — pruning", () => {
    it("returns a zero summary when there are no subscriptions", async () => {
        listSubscriptions.mockResolvedValueOnce([]);
        const { GET } = await importRoute();
        const res = await GET(makeRequest(`Bearer ${SECRET}`));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            deleted: 0,
            kept: 0,
            legacy: 0,
            total: 0,
        });
        expect(deleteSubscription).not.toHaveBeenCalled();
        expect(captureMessage).not.toHaveBeenCalled();
    });

    it("keeps fresh subscriptions (lastReminderAt within window)", async () => {
        const fresh = makeSub({
            browserId: "b-fresh",
            lastReminderAt: Date.now() - 30 * ONE_DAY, // 30 days, within 90
        });
        listSubscriptions.mockResolvedValueOnce([fresh]);
        const { GET } = await importRoute();
        const res = await GET(makeRequest(`Bearer ${SECRET}`));
        const body = await res.json();
        expect(body).toMatchObject({
            deleted: 0,
            kept: 1,
            legacy: 0,
            total: 1,
        });
        expect(deleteSubscription).not.toHaveBeenCalled();
        expect(captureMessage).not.toHaveBeenCalled();
    });

    it("deletes stale subscriptions (lastReminderAt past window)", async () => {
        const stale = makeSub({
            browserId: "b-stale",
            lastReminderAt: Date.now() - 100 * ONE_DAY, // 100 days, past 90
        });
        listSubscriptions.mockResolvedValueOnce([stale]);
        const { GET } = await importRoute();
        const res = await GET(makeRequest(`Bearer ${SECRET}`));
        const body = await res.json();
        expect(body).toMatchObject({
            deleted: 1,
            kept: 0,
            legacy: 0,
            total: 1,
        });
        expect(deleteSubscription).toHaveBeenCalledWith("b-stale");
    });

    it("classifies subscriptions without lastReminderAt as legacy (does NOT delete)", async () => {
        const legacy = makeSub({ browserId: "b-legacy" });
        expect(legacy.lastReminderAt).toBeUndefined();
        listSubscriptions.mockResolvedValueOnce([legacy]);
        const { GET } = await importRoute();
        const res = await GET(makeRequest(`Bearer ${SECRET}`));
        const body = await res.json();
        expect(body).toMatchObject({
            deleted: 0,
            kept: 0,
            legacy: 1,
            total: 1,
        });
        expect(deleteSubscription).not.toHaveBeenCalled();
    });

    it("mixed populations: keeps fresh, deletes stale, leaves legacy alone", async () => {
        const now = Date.now();
        listSubscriptions.mockResolvedValueOnce([
            makeSub({ browserId: "b-fresh", lastReminderAt: now - ONE_DAY }),
            makeSub({
                browserId: "b-stale-1",
                lastReminderAt: now - 95 * ONE_DAY,
            }),
            makeSub({ browserId: "b-legacy" }),
            makeSub({
                browserId: "b-stale-2",
                lastReminderAt: now - 365 * ONE_DAY,
            }),
        ]);
        const { GET } = await importRoute();
        const res = await GET(makeRequest(`Bearer ${SECRET}`));
        const body = await res.json();
        expect(body).toMatchObject({
            deleted: 2,
            kept: 1,
            legacy: 1,
            total: 4,
        });
        expect(deleteSubscription).toHaveBeenCalledWith("b-stale-1");
        expect(deleteSubscription).toHaveBeenCalledWith("b-stale-2");
        expect(deleteSubscription).not.toHaveBeenCalledWith("b-fresh");
        expect(deleteSubscription).not.toHaveBeenCalledWith("b-legacy");
    });

    it("treats lastReminderAt exactly at the window boundary as kept (not deleted)", async () => {
        // Boundary: 90 days exactly — `now - lastReminderAt > GC_WINDOW_MS`
        // is strictly greater, so equal is kept. A subscription touched
        // exactly 90 days ago survives one more round. Time is pinned
        // so the test doesn't race the clock between setup and the
        // route's own `Date.now()`.
        vi.useFakeTimers();
        const fixedNow = 1_700_000_000_000;
        vi.setSystemTime(fixedNow);
        try {
            const boundary = makeSub({
                browserId: "b-boundary",
                lastReminderAt: fixedNow - 90 * ONE_DAY,
            });
            listSubscriptions.mockResolvedValueOnce([boundary]);
            const { GET } = await importRoute();
            const res = await GET(makeRequest(`Bearer ${SECRET}`));
            const body = await res.json();
            expect(body).toMatchObject({
                deleted: 0,
                kept: 1,
                legacy: 0,
                total: 1,
            });
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("GET /api/push/gc-cron — Sentry reporting", () => {
    it("fires a single Sentry captureMessage with counts when deletions happen", async () => {
        const now = Date.now();
        listSubscriptions.mockResolvedValueOnce([
            makeSub({ browserId: "b-1", lastReminderAt: now - 100 * ONE_DAY }),
            makeSub({ browserId: "b-2", lastReminderAt: now - 200 * ONE_DAY }),
            makeSub({ browserId: "b-3", lastReminderAt: now - ONE_DAY }),
        ]);
        const { GET } = await importRoute();
        await GET(makeRequest(`Bearer ${SECRET}`));
        expect(captureMessage).toHaveBeenCalledTimes(1);
        expect(captureMessage).toHaveBeenCalledWith(
            "Pruned stale push subscriptions",
            expect.objectContaining({
                level: "warning",
                tags: expect.objectContaining({
                    area: "push-gc",
                    deleted: 2,
                    kept: 1,
                }),
            }),
        );
    });

    it("does NOT fire Sentry when nothing was deleted (silence on healthy runs)", async () => {
        listSubscriptions.mockResolvedValueOnce([
            makeSub({ browserId: "b-fresh", lastReminderAt: Date.now() }),
        ]);
        const { GET } = await importRoute();
        await GET(makeRequest(`Bearer ${SECRET}`));
        expect(captureMessage).not.toHaveBeenCalled();
    });
});
