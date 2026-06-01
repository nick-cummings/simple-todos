import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { deleteSubscription, listSubscriptions } from "@/lib/pushStore";

// How long must a subscription sit without a successful Web Push
// delivery before we consider it stale and prune it? See
// [ADR 0014](../../../../docs/decisions/0014-stale-subscription-gc.md)
// for the choice of 90 days. The window is long enough that a user
// who genuinely doesn't create a due-date todo for months keeps
// their subscription, but short enough that an abandoned device
// (factory reset, browser uninstalled, OS-level revocation that
// never surfaced a 410) eventually frees its row.
const GC_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Vercel Cron handler. Fires daily (per vercel.json) at a different
 * hour from notify-cron and prunes stale push subscriptions —
 * subscriptions whose `lastReminderAt` is older than the GC window.
 *
 * Behavior:
 *  - Authenticates the bearer token against CRON_SECRET (Vercel Cron
 *    auto-attaches it).
 *  - Scans every `subscription:*` key.
 *  - For each: classified as `legacy` (no `lastReminderAt` — created
 *    before the field existed or never used yet), `kept` (within the
 *    GC window), or `deleted` (older than the window).
 *  - Legacy rows are NEVER auto-deleted. Either notify-cron stamps
 *    them on the next successful send (turning them into `kept`) or
 *    they sit forever — a leak we accept rather than risk wiping
 *    real subscriptions on the very first GC pass.
 *  - When deletions happen, fires a single warning-level Sentry
 *    capture with the counts. Per-deletion captures would spam.
 *  - Returns a summary so the cron log is greppable.
 */
export async function GET(request: Request) {
    if (!isStorageConfigured()) {
        return NextResponse.json(
            { error: "Push storage is not configured." },
            { status: 503 },
        );
    }
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const now = Date.now();
    const subscriptions = await listSubscriptions();

    let kept = 0;
    let legacy = 0;
    let deleted = 0;

    for (const sub of subscriptions) {
        if (sub.lastReminderAt === undefined) {
            legacy += 1;
            continue;
        }
        if (now - sub.lastReminderAt > GC_WINDOW_MS) {
            await deleteSubscription(sub.browserId);
            deleted += 1;
        } else {
            kept += 1;
        }
    }

    if (deleted > 0) {
        Sentry.captureMessage("Pruned stale push subscriptions", {
            level: "warning",
            tags: {
                area: "push-gc",
                deleted,
                kept,
                legacy,
                windowDays: 90,
            },
        });
    }

    return NextResponse.json({
        deleted,
        kept,
        legacy,
        total: subscriptions.length,
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
