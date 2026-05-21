import { NextResponse } from "next/server";

import {
  deleteSubscription,
  type PushSubscriptionJSON,
  saveSubscription,
} from "@/lib/pushStore";

/**
 * Drop a subscription (user disabled reminders or revoked perms).
 * Body: { browserId: string }
 */
export async function DELETE(request: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Push storage is not configured." },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { browserId } = (body ?? {}) as { browserId?: unknown };
  if (typeof browserId !== "string" || browserId.length < 8) {
    return NextResponse.json(
      { error: "browserId is required." },
      { status: 400 },
    );
  }
  await deleteSubscription(browserId);
  return NextResponse.json({ ok: true });
}

/**
 * Register or refresh a Web Push subscription for a browser. The
 * client generates `browserId` once and stores it in localStorage,
 * so updating the saved subscription (e.g. after a rotation) is just
 * a re-POST with the same id.
 *
 * Body: { browserId: string, subscription: PushSubscriptionJSON }
 */
export async function POST(request: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Push storage is not configured." },
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
    return NextResponse.json(
      { error: "Body must be an object." },
      { status: 400 },
    );
  }
  const { browserId, subscription } = body as {
    browserId?: unknown;
    subscription?: unknown;
  };
  if (typeof browserId !== "string" || browserId.length < 8) {
    return NextResponse.json(
      { error: "browserId is required and must be at least 8 chars." },
      { status: 400 },
    );
  }
  if (!isValidSubscription(subscription)) {
    return NextResponse.json(
      { error: "subscription is missing or malformed." },
      { status: 400 },
    );
  }

  await saveSubscription({
    browserId,
    createdAt: Date.now(),
    subscription,
  });

  return NextResponse.json({ ok: true });
}

function isStorageConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function isValidSubscription(v: unknown): v is PushSubscriptionJSON {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.endpoint !== "string" || !o.endpoint.startsWith("https://"))
    return false;
  const keys = o.keys;
  if (!keys || typeof keys !== "object") return false;
  const k = keys as Record<string, unknown>;
  if (typeof k.auth !== "string" || typeof k.p256dh !== "string") return false;
  return true;
}
