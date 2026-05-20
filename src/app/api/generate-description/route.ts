import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  GENERATE_DESCRIPTION_SYSTEM_PROMPT,
  buildUserMessage,
  isValidLocation,
} from "@/lib/prompts/generateDescription";

/**
 * Rate limiter.
 *
 * Prefers an Upstash Redis sliding-window limiter so the counter is
 * shared across all lambda instances. Falls back to an in-memory
 * per-lambda limiter when UPSTASH_REDIS_REST_URL / TOKEN aren't set
 * (local dev, or before the user provisions the Redis instance).
 *
 * 10 requests per IP per hour either way.
 */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = "1 h" as const;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const upstashLimiter = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW),
    analytics: false,
    prefix: "rl:generate-description",
  });
})();

// In-memory fallback (leaky — see note in security audit). Used only
// when Upstash isn't configured.
const buckets = new Map<string, { count: number; reset: number }>();
function inMemoryLimit(ip: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.reset < now) {
    buckets.set(ip, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (b.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((b.reset - now) / 1000),
    };
  }
  b.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

async function checkRateLimit(
  ip: string,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  if (upstashLimiter) {
    const res = await upstashLimiter.limit(ip);
    if (res.success) return { allowed: true, retryAfterSec: 0 };
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    };
  }
  return inMemoryLimit(ip);
}

function clientIp(request: Request): string {
  // Vercel sets x-forwarded-for; first value is the client IP.
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * Server-side proxy that calls Claude Haiku 4.5 to generate a description
 * for a todo title. The Anthropic API key stays on the server — the
 * browser never sees it.
 *
 * The system prompt is marked with cache_control so repeat requests
 * within ~5 minutes hit the cache (cheaper + faster). Note: Haiku 4.5's
 * minimum cacheable prefix is 4096 tokens; if the system prompt falls
 * below that the marker is a no-op (no error, just no cache hit).
 */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is not configured for AI generation." },
      { status: 503 },
    );
  }

  const limit = await checkRateLimit(clientIp(request));
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSec / 60));
    return NextResponse.json(
      { error: `Rate limit reached. Try again in ~${minutes} min.` },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be an object." }, { status: 400 });
  }

  const { title, location } = body as {
    title?: unknown;
    location?: unknown;
  };

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json(
      { error: "title is required." },
      { status: 400 },
    );
  }
  if (title.length > 500) {
    return NextResponse.json(
      { error: "title is too long (max 500 chars)." },
      { status: 400 },
    );
  }

  const validatedLocation = isValidLocation(location) ? location : undefined;

  const client = new Anthropic();

  try {
    // Server-side web_search lets Claude look up real prices, named
    // businesses, and specific advice rather than just suggesting the
    // user search themselves. Anthropic runs the queries and returns
    // results to Claude; we pay only for tokens. If the model decides
    // the title is trivial (e.g. "buy milk"), it skips the search.
    //
    // Capped at a single model turn — we do NOT honor `pause_turn`.
    // A short todo description never needs more tool calls than fit in
    // one server-side sampling loop, and capping here prevents a
    // crafted title from running up the bill via runaway tool chains.
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: GENERATE_DESCRIPTION_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: buildUserMessage({ title, location: validatedLocation }),
        },
      ],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json(
        { error: "Model returned an empty response." },
        { status: 502 },
      );
    }

    return NextResponse.json({ description: text });
  } catch (error) {
    // Typed exception handling per the Anthropic SDK conventions.
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limited — try again in a moment." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "AI service authentication failed." },
        { status: 502 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI service error (${error.status}).` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Unexpected error generating description." },
      { status: 500 },
    );
  }
}
