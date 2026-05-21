import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` runs before any module factory, guaranteeing that the
// spies referenced inside the mocks below are initialized when their
// factories execute.
const { errors, mockCreate, mockLimit } = vi.hoisted(() => {
  class MockAPIError extends Error {
    status: number;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  }
  class MockRateLimitError extends MockAPIError {}
  class MockAuthenticationError extends MockAPIError {}
  return {
    errors: { MockAPIError, MockAuthenticationError, MockRateLimitError },
    mockCreate: vi.fn(),
    mockLimit: vi.fn(),
  };
});

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    static APIError = errors.MockAPIError;
    static AuthenticationError = errors.MockAuthenticationError;
    static RateLimitError = errors.MockRateLimitError;
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

vi.mock("@upstash/ratelimit", () => {
  class MockRatelimit {
    static slidingWindow = vi.fn(() => "limiter-config");
    async limit(ip: string) {
      return mockLimit(ip);
    }
  }
  return { Ratelimit: MockRatelimit };
});

vi.mock("@upstash/redis", () => {
  class MockRedis {}
  return { Redis: MockRedis };
});

const ORIGINAL_ENV = { ...process.env };

async function importPOST() {
  vi.resetModules();
  const mod = await import("./route");
  return mod.POST;
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/generate-description", {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
    method: "POST",
  });
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, ANTHROPIC_API_KEY: "test-key" };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  mockCreate.mockReset();
  mockLimit.mockReset();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/generate-description — environment gating", () => {
  it("returns 503 when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const POST = await importPOST();
    const res = await POST(makeRequest({ title: "x" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/configured/i);
  });
});

describe("POST /api/generate-description — body validation", () => {
  it("returns 400 for invalid JSON", async () => {
    const POST = await importPOST();
    const res = await POST(makeRequest("not valid json"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/JSON/i);
  });

  it("returns 400 for null body", async () => {
    const POST = await importPOST();
    const res = await POST(makeRequest(null));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/object/i);
  });

  it("returns 400 for a non-string title", async () => {
    const POST = await importPOST();
    const res = await POST(makeRequest({ title: 42 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a whitespace-only title", async () => {
    const POST = await importPOST();
    const res = await POST(makeRequest({ title: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a title longer than 500 chars", async () => {
    const POST = await importPOST();
    const res = await POST(makeRequest({ title: "x".repeat(501) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too long/i);
  });
});

describe("POST /api/generate-description — successful generation", () => {
  it("returns 200 with description text on success", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: "Detailed description here.", type: "text" }],
    });
    const POST = await importPOST();
    const res = await POST(makeRequest({ title: "buy milk" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      description: "Detailed description here.",
    });
  });

  it("concatenates multiple text blocks and ignores non-text blocks", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        { id: "x", input: {}, name: "web_search", type: "tool_use" },
        { text: "First part. ", type: "text" },
        { content: "ignored", tool_use_id: "x", type: "tool_result" },
        { text: "Second part.", type: "text" },
      ],
    });
    const POST = await importPOST();
    const res = await POST(makeRequest({ title: "x" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      description: "First part. Second part.",
    });
  });

  it("returns 502 when the model returns only whitespace", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: "   ", type: "text" }],
    });
    const POST = await importPOST();
    const res = await POST(makeRequest({ title: "x" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/empty/i);
  });

  it("passes title and validated location into the user message", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: "ok", type: "text" }],
    });
    const POST = await importPOST();
    await POST(
      makeRequest({
        location: { latitude: 40.7128, longitude: -74.006 },
        title: "find coffee",
      }),
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe("claude-sonnet-4-6");
    expect(call.messages[0].content).toContain("find coffee");
    expect(call.messages[0].content).toContain("40.7128");
    expect(call.messages[0].content).toContain("-74.0060");
    // Cache breakpoint should be on the system prompt.
    expect(call.system[0].cache_control).toEqual({ type: "ephemeral" });
    // Web search tool should be wired up.
    expect(call.tools).toEqual([
      { name: "web_search", type: "web_search_20250305" },
    ]);
  });

  it("ignores an invalid location and still succeeds", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: "ok", type: "text" }],
    });
    const POST = await importPOST();
    await POST(
      makeRequest({
        location: { latitude: 200, longitude: 0 },
        title: "x",
      }),
    );
    const userMessage = mockCreate.mock.calls[0][0].messages[0].content;
    expect(userMessage).not.toMatch(/location/i);
  });
});

describe("POST /api/generate-description — typed Anthropic errors", () => {
  it("maps RateLimitError to 429", async () => {
    mockCreate.mockRejectedValueOnce(
      new errors.MockRateLimitError("upstream rate-limited", 429),
    );
    const POST = await importPOST();
    const res = await POST(makeRequest({ title: "x" }));
    expect(res.status).toBe(429);
  });

  it("maps AuthenticationError to 502", async () => {
    mockCreate.mockRejectedValueOnce(
      new errors.MockAuthenticationError("bad key", 401),
    );
    const POST = await importPOST();
    const res = await POST(makeRequest({ title: "x" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/authentication/i);
  });

  it("maps generic APIError to 502 with status in message", async () => {
    mockCreate.mockRejectedValueOnce(
      new errors.MockAPIError("server angry", 503),
    );
    const POST = await importPOST();
    const res = await POST(makeRequest({ title: "x" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/503/);
  });

  it("maps unknown errors to 500", async () => {
    mockCreate.mockRejectedValueOnce(new Error("kaboom"));
    const POST = await importPOST();
    const res = await POST(makeRequest({ title: "x" }));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/generate-description — in-memory rate limit", () => {
  it("returns 429 after exhausting the per-IP budget", async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: "ok", type: "text" }],
    });
    const POST = await importPOST();
    for (let i = 0; i < 20; i++) {
      const res = await POST(
        makeRequest({ title: "x" }, { "x-forwarded-for": "9.9.9.9" }),
      );
      expect(res.status).toBe(200);
    }
    const tooMany = await POST(
      makeRequest({ title: "x" }, { "x-forwarded-for": "9.9.9.9" }),
    );
    expect(tooMany.status).toBe(429);
    expect(tooMany.headers.get("retry-after")).toBeTruthy();
  });

  it("isolates buckets by IP", async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: "ok", type: "text" }],
    });
    const POST = await importPOST();
    // Burn 20 calls from IP A.
    for (let i = 0; i < 20; i++) {
      await POST(makeRequest({ title: "x" }, { "x-forwarded-for": "1.1.1.1" }));
    }
    // A 21st A-call is denied, but a B-call still succeeds.
    const denied = await POST(
      makeRequest({ title: "x" }, { "x-forwarded-for": "1.1.1.1" }),
    );
    const allowed = await POST(
      makeRequest({ title: "x" }, { "x-forwarded-for": "2.2.2.2" }),
    );
    expect(denied.status).toBe(429);
    expect(allowed.status).toBe(200);
  });
});

describe("POST /api/generate-description — Upstash rate limit", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  it("delegates to Upstash when env is set and allows successful request", async () => {
    mockLimit.mockResolvedValueOnce({
      reset: Date.now() + 60_000,
      success: true,
    });
    mockCreate.mockResolvedValueOnce({
      content: [{ text: "ok", type: "text" }],
    });
    const POST = await importPOST();
    const res = await POST(
      makeRequest({ title: "x" }, { "x-forwarded-for": "3.3.3.3" }),
    );
    expect(res.status).toBe(200);
    expect(mockLimit).toHaveBeenCalledWith("3.3.3.3");
  });

  it("returns 429 when Upstash denies the request", async () => {
    mockLimit.mockResolvedValueOnce({
      reset: Date.now() + 5 * 60_000,
      success: false,
    });
    const POST = await importPOST();
    const res = await POST(makeRequest({ title: "x" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    const body = await res.json();
    expect(body.error).toMatch(/rate limit/i);
  });
});

describe("POST /api/generate-description — IP extraction", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    mockLimit.mockResolvedValue({ success: true });
    mockCreate.mockResolvedValue({
      content: [{ text: "ok", type: "text" }],
    });
  });

  it("extracts the first IP from x-forwarded-for", async () => {
    const POST = await importPOST();
    await POST(
      makeRequest(
        { title: "x" },
        { "x-forwarded-for": "  4.4.4.4 , 5.5.5.5 , 6.6.6.6" },
      ),
    );
    expect(mockLimit).toHaveBeenCalledWith("4.4.4.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", async () => {
    const POST = await importPOST();
    await POST(makeRequest({ title: "x" }, { "x-real-ip": "  7.7.7.7  " }));
    expect(mockLimit).toHaveBeenCalledWith("7.7.7.7");
  });

  it("falls back to 'unknown' when no client IP headers are present", async () => {
    const POST = await importPOST();
    await POST(makeRequest({ title: "x" }));
    expect(mockLimit).toHaveBeenCalledWith("unknown");
  });
});
