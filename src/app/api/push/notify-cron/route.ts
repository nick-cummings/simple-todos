import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

import {
    deleteReminder,
    deleteSubscription,
    getSubscription,
    listReminders,
    markReminderSent,
    markSubscriptionUsed,
} from "@/lib/pushStore";
import { sendReminderPush } from "@/lib/webPush";

// How long after a successful Web Push send do we treat the reminder
// as "already delivered" if it somehow survives in Redis? The cron
// runs daily; this window only needs to be long enough that an
// unintended re-trigger (manual curl, retried cron) within hours of
// a real send doesn't cause a duplicate notification. 6 hours is the
// compromise between "definitely longer than any retry storm" and
// "not so long it would mask a legitimate re-arming".
const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;

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
    let deduped = 0;
    // Avoid double-hitting Upstash for the same browserId during one
    // cron run — many reminders can share a subscription.
    const cache = new Map<string, ReturnType<typeof getSubscription>>();

    for (const reminder of due) {
        // Idempotency gate: if a previous cron run successfully sent
        // this reminder but crashed before deleting it, skip+clean up
        // instead of resending. The `sentAt` write happens immediately
        // after a successful push, before the delete, so a stale record
        // with recent sentAt is the marker of a delete-failure window.
        if (
            reminder.sentAt !== undefined &&
            now - reminder.sentAt < DEDUPE_WINDOW_MS
        ) {
            deduped += 1;
            await deleteReminder(reminder.id);
            continue;
        }

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
            // Two writes intentionally split: markReminderSent first so
            // a crash before the delete leaves a recoverable marker; then
            // delete. If markReminderSent itself fails the next run
            // resends — acceptable since that requires Redis itself to
            // fail mid-cron, which is rare.
            await markReminderSent(reminder.id, now);
            await deleteReminder(reminder.id);
            // Stamp the subscription so the GC cron can tell it's still
            // alive. A failure here doesn't change the delivery outcome
            // (the push already went out); the GC just sees a slightly
            // stale lastReminderAt next run.
            await markSubscriptionUsed(reminder.browserId, now);
        } else if (outcome.status === "expired") {
            expired += 1;
            await deleteReminder(reminder.id);
            await deleteSubscription(reminder.browserId);
            cache.set(reminder.browserId, Promise.resolve(null));
        } else {
            failed += 1;
            // Surface per-push failures to Sentry with enough context to
            // diagnose. Leave the reminder in place so the next cron retries.
            Sentry.captureMessage("Web Push delivery failed", {
                level: "warning",
                tags: {
                    area: "push-cron",
                    reminderId: reminder.id,
                    statusCode: outcome.statusCode ?? "unknown",
                },
            });
        }
    }

    return NextResponse.json({
        deduped,
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
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN,
    );
}

function isVapidConfigured(): boolean {
    return Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY &&
        process.env.VAPID_SUBJECT,
    );
}
