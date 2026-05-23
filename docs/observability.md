# Observability

## What we have today

| Source                  | Sink             | What it captures                                                  |
| ----------------------- | ---------------- | ----------------------------------------------------------------- |
| Sentry — browser SDK    | Sentry           | Client-side unhandled errors, including React render boundaries.  |
| Sentry — Node SDK       | Sentry           | API route exceptions via Next's `onRequestError` instrumentation. |
| Sentry — explicit calls | Sentry           | Page-level + root-layout boundaries; per-push failures in cron.   |
| `console.error`         | Browser / Vercel | Same events, kept for in-process DevTools debugging.              |
| Vercel platform metrics | Vercel dashboard | Build, deploy, function durations, error rates.                   |

### Sentry tagging

| Tag        | Values                        | Meaning                                              |
| ---------- | ----------------------------- | ---------------------------------------------------- |
| `runtime`  | `browser` / `nodejs` / `edge` | Where the event originated. Set by SDK init.         |
| `boundary` | `page` / `global`             | Which React Error Boundary caught (when applicable). |
| `area`     | `push-cron`                   | Component / pipeline the event is about.             |

See [ADR 0011](./decisions/0011-sentry-for-error-reporting.md) for the
"why this over Slack / self-hosted" decision and the full set of
consequences.

### Required env vars

| Variable                 | Used at     | Notes                                              |
| ------------------------ | ----------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN` | build + run | Without it the SDK silently no-ops. Set in Vercel. |
| `SENTRY_AUTH_TOKEN`      | build only  | Source map upload during `next build`. Optional.   |
| `SENTRY_ORG`             | build only  | Source map upload target.                          |
| `SENTRY_PROJECT`         | build only  | Source map upload target.                          |

If `NEXT_PUBLIC_SENTRY_DSN` is unset locally, dev and previews stay
zero-cost — the SDK initializes to a no-op.

## Planned wiring

### PostHog (planned — PR 7)

- `posthog-js` for client analytics.
- Session-level event taxonomy (see PR 7's ADR for the full list).
- No PII; events are shape-only (`todo_created`, `reminder_enabled`,
  `backup_exported`, etc.).
- Self-host opt-out via Settings.

ADR: [decisions/0013-posthog-for-analytics.md](./decisions/0013-posthog-for-analytics.md)
(written in PR 7).

## What to watch for in production

- **Spike in `boundary=page` or `boundary=global` events** — something
  recently shipped is throwing. Filter Sentry by `boundary` tag.
- **`area=push-cron` warnings** — Web Push delivery failing for the
  author's device. `statusCode` tag tells you whether it's a transient
  5xx or a permanent 410. Per-device 410s mean a dead subscription
  that should be GC'd.
- **Cron not running** — Vercel Cron is hobby-tier and silently skips
  on outages. Sentry won't catch this (no exception is thrown).
  Check `Vercel dashboard → Cron Jobs` history.
- **`reminder:*` keys piling up in Upstash without firing** — means
  the cron is hitting the route but failing past the auth step.
  Inspect Vercel function logs.

## How to debug a production issue

1. Check Sentry first. Filter by `runtime`, `boundary`, or `area`
   tags to find the relevant events.
2. If client-side and Sentry has nothing useful: reproduce in Chrome
   DevTools against the production URL. The Application tab → Service
   Workers panel sometimes reveals a stale shell.
3. If server-side: `vercel logs <deployment-url> --follow` (requires
   `vercel` CLI logged in). Sentry should already have the exception
   if it was an uncaught throw.
4. If reminder-related: inspect Upstash directly via its dashboard.
   `reminder:*` keys are JSON; grep `fireAt` to see what should be
   firing.
