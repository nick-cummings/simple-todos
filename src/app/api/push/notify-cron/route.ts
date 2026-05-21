import { NextResponse } from "next/server";

import {
  deleteReminder,
  deleteSubscription,
  getSubscription,
  listReminders,
} from "@/lib/pushStore";
import { sendReminderPush } from "@/lib/webPush";

/**
 * Vercel Cron handler. Fires daily (per vercel.json) and dispatches
 * every reminder whose fireAt has elapsed.
 *
 * Behavior:
 *  - Authenticates the bearer token against CRON_SECRET (Vercel Cron
 *    auto-attaches it).
 *  - Scans `reminder:*` keys, filters to fireAt <= now.
 *  - For each, looks up subscription:<browserId>, sends a Web Push,
 *    and deletes the reminder.
 *  - On 404/410 from the push service, also deletes the
 *    subscription (the device is gone).
 *  - Returns a summary so the cron log is greppable.
 */
export async function GET(request: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Push storage is not configured." },
      { status: 503 },
    );
  }
  if (!isVapidConfigured()) {
    return NextResponse.json(
      { error: "Web Push is not configured (VAPID keys missing)." },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = Date.now();
  const reminders = await listReminders();
  const due = reminders.filter((r) => r.fireAt <= now);

  let sent = 0;
  let expired = 0;
  let failed = 0;
  // Avoid double-hitting Upstash for the same browserId during one
  // cron run — many reminders can share a subscription.
  const cache = new Map<string, ReturnType<typeof getSubscription>>();

  for (const reminder of due) {
    let lookup = cache.get(reminder.browserId);
    if (!lookup) {
      lookup = getSubscription(reminder.browserId);
      cache.set(reminder.browserId, lookup);
    }
    const sub = await lookup;
    if (!sub) {
      // Subscription is gone; drop the reminder so we don't keep
      // trying every cron tick.
      await deleteReminder(reminder.id);
      continue;
    }
    const outcome = await sendReminderPush(sub.subscription, reminder);
    if (outcome.status === "sent") {
      sent += 1;
      await deleteReminder(reminder.id);
    } else if (outcome.status === "expired") {
      expired += 1;
      await deleteReminder(reminder.id);
      await deleteSubscription(reminder.browserId);
      cache.set(reminder.browserId, Promise.resolve(null));
    } else {
      failed += 1;
      // Leave failed reminders in place so the next cron retries.
    }
  }

  return NextResponse.json({
    expired,
    failed,
    sent,
    skipped: reminders.length - due.length,
    total: reminders.length,
  });
}

function isAuthorized(request: Request): boolean {
  // If no secret is configured we refuse everything — better than
  // letting anonymous traffic trigger a cron pass.
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

function isStorageConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function isVapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );
}
