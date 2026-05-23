---
status: accepted
date: 2026-05-01
---

# 0003 — Stay on the Vercel Hobby tier

## Context

The app deploys to Vercel. Vercel has three tiers (Hobby, Pro,
Enterprise) with progressively richer capabilities. The Hobby tier is
free but has hard limits that shape what we can build:

| Feature           | Hobby                              |
| ----------------- | ---------------------------------- |
| Cron schedules    | Daily only (no sub-daily)          |
| Function duration | 10s (configurable to 60s for some) |
| Function memory   | 1 GB                               |
| Bandwidth         | 100 GB / month                     |
| Deployments       | Unlimited                          |
| Custom domains    | Yes                                |
| Team members      | 1                                  |

The relevant constraint here is the cron one. Web Push reminders for
todos due "today" want to fire at a useful local-time hour (say
mid-morning), but Hobby only allows a single daily cadence.

## Decision

Stay on Hobby. Accept the daily cron limitation and pick a single fire
time globally. We chose 15:00 UTC which lands at 11:00 EDT — within the
author's typical mid-morning window.

Function timeouts and memory have never been a constraint; the
heaviest endpoint is `/api/generate-description` calling Anthropic,
which streams and completes well under 10s in practice.

## Alternatives considered

- **Upgrade to Pro.** Unlocks hourly cron schedules and longer function
  timeouts but costs $20/month for a single-user app. Not justified.
- **Self-host the cron.** Run a worker on a Hetzner box or similar
  that pings `/api/push/notify-cron` on a custom schedule. Adds an
  always-on dependency and a second deploy surface for marginal
  benefit.
- **Per-todo client-scheduled reminders.** Have the client schedule a
  Web Push subscription with an explicit fire time. Web Push doesn't
  support scheduled delivery directly; you'd need a server-side
  scheduler regardless.

## Consequences

- **Reminders are once-daily, not at the user's exact preferred time.**
  Acceptable for the single-user use case.
- **The cron is the single point of failure for reminders.** If Vercel
  Cron drops a fire, the reminder doesn't go out that day. We accept
  this in exchange for not running our own infra.
- **The 10s function timeout shapes the AI route's design.** Anthropic
  responses occasionally take longer; we stream and return as soon as
  we have a useful response rather than blocking on the full stream.
- **Bandwidth budget is plenty.** Single-user PWA traffic is
  negligible.

## References

- Cron config: `vercel.json`
- Cron handler: `src/app/api/push/notify-cron/route.ts`
- Reminders pipeline: [features/reminders.md](../features/reminders.md)
