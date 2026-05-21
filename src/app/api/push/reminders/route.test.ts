import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveReminder = vi.fn();

vi.mock("@/lib/pushStore", () => ({
  saveReminder: (...a: unknown[]) => saveReminder(...a),
}));

const ORIGINAL_ENV = { ...process.env };

async function importRoute() {
  vi.resetModules();
  return await import("./route");
}

function req(body: unknown) {
  return new Request("http://localhost/api/push/reminders", {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

const FULL = {
  body: "Due today",
  browserId: "deadbeef1",
  fireAt: 1_700_000_000_000,
  id: "rem-1",
  title: "Take out trash",
  todoId: "t1",
  url: "/?todo=t1",
};

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    UPSTASH_REDIS_REST_TOKEN: "tok",
    UPSTASH_REDIS_REST_URL: "https://r",
  };
  saveReminder.mockReset();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/push/reminders", () => {
  it("saves a valid reminder", async () => {
    const { POST } = await importRoute();
    const res = await POST(req(FULL));
    expect(res.status).toBe(200);
    expect(saveReminder).toHaveBeenCalledWith(FULL);
  });

  it("returns 503 when storage isn't configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const { POST } = await importRoute();
    const res = await POST(req(FULL));
    expect(res.status).toBe(503);
  });

  it("rejects invalid JSON", async () => {
    const { POST } = await importRoute();
    const res = await POST(req("nope"));
    expect(res.status).toBe(400);
  });

  it.each([
    ["id missing", { ...FULL, id: undefined }],
    ["id too short", { ...FULL, id: "x" }],
    ["browserId too short", { ...FULL, browserId: "abc" }],
    ["title empty", { ...FULL, title: "" }],
    ["title too long", { ...FULL, title: "x".repeat(201) }],
    ["body too long", { ...FULL, body: "x".repeat(501) }],
    ["url missing slash", { ...FULL, url: "todo" }],
    ["fireAt NaN", { ...FULL, fireAt: Number.NaN }],
    ["fireAt string", { ...FULL, fireAt: "now" }],
    ["todoId empty", { ...FULL, todoId: "" }],
  ])("rejects when %s", async (_label, body) => {
    const { POST } = await importRoute();
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(saveReminder).not.toHaveBeenCalled();
  });
});
