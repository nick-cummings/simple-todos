import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PushSubscriptionJSON } from "@/lib/pushStore";

const saveSubscription = vi.fn();
const deleteSubscriptionMock = vi.fn();

vi.mock("@/lib/pushStore", () => ({
  deleteSubscription: (...a: unknown[]) => deleteSubscriptionMock(...a),
  saveSubscription: (...a: unknown[]) => saveSubscription(...a),
}));

const ORIGINAL_ENV = { ...process.env };

async function importRoute() {
  vi.resetModules();
  return await import("./route");
}

const VALID_SUB: PushSubscriptionJSON = {
  endpoint: "https://example.com/push/abc",
  keys: { auth: "auth", p256dh: "p256" },
};

function makeRequest(body: unknown, method: "DELETE" | "POST" = "POST") {
  return new Request("http://localhost/api/push/subscribe", {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method,
  });
}

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    UPSTASH_REDIS_REST_TOKEN: "tok",
    UPSTASH_REDIS_REST_URL: "https://r",
  };
  saveSubscription.mockReset();
  deleteSubscriptionMock.mockReset();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/push/subscribe", () => {
  it("returns 503 when Upstash env is missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const { POST } = await importRoute();
    const res = await POST(
      makeRequest({ browserId: "deadbeef1", subscription: VALID_SUB }),
    );
    expect(res.status).toBe(503);
  });

  it("rejects invalid JSON with 400", async () => {
    const { POST } = await importRoute();
    const res = await POST(makeRequest("not json"));
    expect(res.status).toBe(400);
  });

  it("rejects a missing browserId", async () => {
    const { POST } = await importRoute();
    const res = await POST(makeRequest({ subscription: VALID_SUB }));
    expect(res.status).toBe(400);
  });

  it("rejects a too-short browserId", async () => {
    const { POST } = await importRoute();
    const res = await POST(
      makeRequest({ browserId: "short", subscription: VALID_SUB }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed subscription (missing keys)", async () => {
    const { POST } = await importRoute();
    const res = await POST(
      makeRequest({
        browserId: "deadbeef1",
        subscription: { endpoint: "https://x" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a non-https endpoint", async () => {
    const { POST } = await importRoute();
    // The literal `http://` here is the whole point of the test;
    // disable the clear-text-protocol rule for this assertion.
    /* eslint-disable sonarjs/no-clear-text-protocols */
    const res = await POST(
      makeRequest({
        browserId: "deadbeef1",
        subscription: { ...VALID_SUB, endpoint: "http://insecure" },
      }),
    );
    /* eslint-enable sonarjs/no-clear-text-protocols */
    expect(res.status).toBe(400);
  });

  it("saves a valid subscription with createdAt timestamp", async () => {
    const { POST } = await importRoute();
    const res = await POST(
      makeRequest({ browserId: "deadbeef1", subscription: VALID_SUB }),
    );
    expect(res.status).toBe(200);
    expect(saveSubscription).toHaveBeenCalledTimes(1);
    const arg = saveSubscription.mock.calls[0][0];
    expect(arg.browserId).toBe("deadbeef1");
    expect(arg.subscription).toEqual(VALID_SUB);
    expect(typeof arg.createdAt).toBe("number");
  });
});

describe("DELETE /api/push/subscribe", () => {
  it("removes the subscription", async () => {
    const { DELETE } = await importRoute();
    const res = await DELETE(makeRequest({ browserId: "deadbeef1" }, "DELETE"));
    expect(res.status).toBe(200);
    expect(deleteSubscriptionMock).toHaveBeenCalledWith("deadbeef1");
  });

  it("rejects without a valid browserId", async () => {
    const { DELETE } = await importRoute();
    const res = await DELETE(makeRequest({}, "DELETE"));
    expect(res.status).toBe(400);
    expect(deleteSubscriptionMock).not.toHaveBeenCalled();
  });

  it("returns 503 when storage isn't configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { DELETE } = await importRoute();
    const res = await DELETE(makeRequest({ browserId: "deadbeef1" }, "DELETE"));
    expect(res.status).toBe(503);
  });
});
