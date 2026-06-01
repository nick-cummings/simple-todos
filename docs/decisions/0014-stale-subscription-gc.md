---
status: accepted
date: 2026-05-24
---

# 0013 — Garbage-collect stale push subscriptions on a separate daily cron

## Context

[features/reminders.md](../features/reminders.md) flagged a real leak:

> **410 GONE handling is partial.** The cron deletes the subscription
> on a 410 from the push service (good), but doesn't have a separate
> GC for subscriptions that haven't received any reminder recently
> (so a device that's dead in another way can accumulate).

`notify-cron` removes a subscription only when the push service
explicitly tells us the endpoint is gone. Many failure modes never
produce a 410:

- The user revoked notifications at the OS level
- The browser was uninstalled
- The device was factory-reset
- The push service silently dropped the endpoint
- The user simply hasn't created a due-date todo for months

In all of those cases the `subscription:<browserId>` row sits in
Upstash forever. For the author's personal use the leak is tiny.
But it's a leak, and the fix is cheap; the doc convention
([ADR 0001](./0001-everything-substantial-gets-a-doc.md)) says
"document it or fix it." This decision fixes it.

## Decision

A second daily cron, `/api/push/gc-cron`, scheduled at 10:00 UTC
(separate from `notify-cron`'s 15:00 UTC). It:

1. Authenticates against `CRON_SECRET` (same gate as notify-cron).
2. Scans every `subscription:*` key via `listSubscriptions()`.
3. Classifies each row as:
    - **`kept`** — `lastReminderAt` is within the last 90 days.
    - **`deleted`** — `lastReminderAt` is older than 90 days; row is
      removed via `deleteSubscription()`.
    - **`legacy`** — `lastReminderAt` is unset. Legacy rows are
      never auto-deleted; see "legacy rows" below.
4. If `deleted > 0`, fires a single Sentry `captureMessage` at
   `warning` level with the counts as tags (`area: push-gc`,
   `deleted`, `kept`, `legacy`, `windowDays: 90`). Per-deletion
   captures would spam Sentry.
5. Returns a JSON summary so the cron log is greppable.

`notify-cron` is updated to call `markSubscriptionUsed(browserId,
now)` after every successful `sent` outcome, so the freshness
timestamp keeps in sync with reality.

## Alternatives considered

- **Fold the GC into `notify-cron` instead of a separate route.**
  Tempting (one less cron), but the two have different schedules
  (notify is user-facing, GC is housekeeping), different failure
  modes (notify failing = missed reminders, GC failing = a leak we
  can live with for a day), and different test surfaces. Separating
  them keeps each one boring.

- **Auto-delete legacy rows (treat missing `lastReminderAt` as
  "very old").** Easier to write, but on the first run it would
  wipe every existing subscription — including the author's real
  iPhone subscription which has been working fine. Bad blast
  radius. Better to be patient: `notify-cron`'s next successful
  push backfills the legacy row by calling `markSubscriptionUsed`,
  converting it to `kept`. Anything that's truly abandoned just
  sits as `legacy` for a while longer; acceptable.

- **Smaller GC window (30 days).** Too aggressive. A user who
  doesn't create a due-date todo for a month and a day shouldn't
  have to re-grant permission.

- **Larger GC window (1 year).** Lets the leak stay almost as bad
  as it is today. 90 days is the rough sweet spot.

- **Sub-daily cron (e.g. hourly).** Vercel Hobby doesn't support
  it ([ADR 0003](./0003-vercel-hobby-constraints.md)). Daily is
  fine — GC is not latency-sensitive.

## Consequences

- **`PushSubscriptionRecord` gains an optional `lastReminderAt`
  field.** Callers that construct records (tests, the subscribe
  route) don't need to set it — `notify-cron` populates it
  organically on the first successful push.
- **`notify-cron` does one extra Upstash write per successful
  send** (`markSubscriptionUsed`). Trivial cost.
- **`vercel.json` now declares two crons.** Vercel Hobby allows
  multiple daily crons (2 is within the limit). Any future cron
  need would require dropping one of these or upgrading.
- **Legacy rows linger.** They eventually get stamped (via
  `notify-cron`) or remain forever. Acceptable; the leak is tiny
  in absolute terms and the alternative (auto-deletion on first
  run) is much worse.
- **The 90-day window is a guess.** If Sentry shows the GC running
  with `deleted: 0` for months on end, we can tighten it. If it
  keeps deleting active-feeling subscriptions, loosen it. The
  number is parameterized in code (`GC_WINDOW_MS`) and easy to
  change.
- **Cron auth is shared with `notify-cron`** via `CRON_SECRET`.
  One secret, two routes — fine, both routes are housekeeping.

## References

- Route: `src/app/api/push/gc-cron/route.ts`
- Tests: `src/app/api/push/gc-cron/route.test.ts`
- Pushstore helpers: `src/lib/pushStore.ts` (`listSubscriptions`,
  `markSubscriptionUsed`)
- Cron schedule: `vercel.json`
- Runbook: [operations/gc-stale-subscriptions.md](../operations/gc-stale-subscriptions.md)
- Related ADRs:
  [0003 Vercel Hobby constraints](./0003-vercel-hobby-constraints.md),
  [0004 Web Push via VAPID](./0004-web-push-via-vapid.md),
  [0011 Sentry for error reporting](./0011-sentry-for-error-reporting.md)
