# Runbook: stale push subscription garbage collection

A daily Vercel Cron at 10:00 UTC hits `/api/push/gc-cron` and
prunes any Web Push subscription that hasn't received a successful
delivery in the last 90 days. The design lives in
[ADR 0014](../decisions/0014-stale-subscription-gc.md); this doc
covers how it behaves in production and how to inspect / intervene.

## What it does

For every subscription in Upstash:

| Classification | Condition                                          | Action      |
| -------------- | -------------------------------------------------- | ----------- |
| `kept`         | `lastReminderAt` within the last 90 days           | leave alone |
| `deleted`      | `lastReminderAt` older than 90 days                | remove row  |
| `legacy`       | `lastReminderAt` unset (pre-GC row, never stamped) | leave alone |

Legacy rows get stamped by `notify-cron` the next time they
receive a successful push, which converts them to `kept`. Until
then, they sit in the store untouched.

## Where to look in production

### Vercel dashboard

Project → **Cron Jobs** tab. Both `notify-cron` (15:00 UTC) and
`gc-cron` (10:00 UTC) should be listed and active. Click into
either to see the per-day execution history.

### Sentry

A successful GC run with `deleted > 0` fires one
`captureMessage("Pruned stale push subscriptions")` event at
`warning` level. Filter Sentry by:

- `area:push-gc` — narrows to GC events only.

Each event carries `deleted`, `kept`, `legacy`, and `windowDays`
tags. A run with zero deletions is silent — no Sentry events. If
the GC has truly never deleted anything, you won't see anything in
Sentry at all; check the Vercel cron log instead.

### Vercel function logs

The cron handler returns JSON like:

```json
{ "total": 7, "kept": 5, "legacy": 1, "deleted": 1 }
```

`total` is the count of subscriptions scanned. `kept + legacy +
deleted` should equal `total`. If they don't, something's wrong.

## How to manually trigger the GC

Same pattern as manually triggering `notify-cron`:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://nick-todos.vercel.app/api/push/gc-cron
```

The `CRON_SECRET` lives in `infra/terraform.tfvars` (gitignored).
The route checks bearer auth before doing anything; unauthenticated
hits get 401 and don't touch Upstash.

## When you should worry

| Symptom                                                | Likely cause                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| GC fires daily, never deletes anything                 | Every subscription is active (good) OR window is too generous |
| GC deletes the author's own subscription               | `lastReminderAt` isn't being stamped; check `notify-cron`     |
| `legacy` count stays nonzero forever                   | Some subscription never gets a real push; ok to ignore unless |
|                                                        | it's your own — then check the user's notification history    |
| Sentry shows `total` growing unboundedly across runs   | The leak is wider than 410-misses; investigate `notify-cron`  |
| `total + kept + legacy + deleted` math doesn't balance | Code bug; check the route handler                             |

## When you want to change the window

The window is a single constant in `src/app/api/push/gc-cron/route.ts`:

```ts
const GC_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
```

Tightening to 30 days = more aggressive; consider if Sentry shows
no false-positive deletions over a couple of months. Loosening to
180+ days = the leak stays bad but the false-positive risk drops.

Don't change this without a follow-up to ADR 0014 explaining why.

## Related

- [ADR 0014 — stale subscription GC](../decisions/0014-stale-subscription-gc.md)
- [ADR 0003 — Vercel Hobby constraints](../decisions/0003-vercel-hobby-constraints.md)
  (why daily instead of weekly)
- [ADR 0004 — Web Push via VAPID](../decisions/0004-web-push-via-vapid.md)
- [features/reminders.md](../features/reminders.md)
