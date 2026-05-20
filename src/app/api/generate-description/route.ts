import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  GENERATE_DESCRIPTION_SYSTEM_PROMPT,
  buildUserMessage,
  isValidLocation,
} from "@/lib/prompts/generateDescription";

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
    // If the server-side sampling loop hits its iteration cap, the
    // response has `stop_reason: "pause_turn"` and we replay it once
    // to resume. One retry is enough for this short, focused task.
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: buildUserMessage({ title, location: validatedLocation }),
      },
    ];
    let response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: GENERATE_DESCRIPTION_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    });
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: [
          {
            type: "text",
            text: GENERATE_DESCRIPTION_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      });
    }

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
