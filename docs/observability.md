# Observability

> **Status:** partial. This doc describes both what exists today and the
> planned Sentry + PostHog wiring. Sections marked **(planned)** ship in
> later PRs.

## What we have today

| Source                  | Sink             | What it captures                                |
| ----------------------- | ---------------- | ----------------------------------------------- |
| Client `console.error`  | Browser console  | Anything that throws, including React renders.  |
| `error.tsx`             | Browser console  | Page-level boundary catches; logged on mount.   |
| `global-error.tsx`      | Browser console  | Root-layout boundary catches; logged on mount.  |
| Server `console.error`  | Vercel logs      | API route exceptions, cron handler errors.      |
| Vercel platform metrics | Vercel dashboard | Build, deploy, function durations, error rates. |

For day-one solo development this is enough, but it has clear blind
spots: anything that happens on the author's iPhone PWA when DevTools
isn't attached is silent. The next PR fixes that.

## Planned wiring

### Sentry (planned — PR 3)

- `@sentry/nextjs` SDK on client + server.
- Captures unhandled errors from client React boundaries, server
  exceptions in API routes, and cron handler errors.
- Source maps uploaded so stack traces deminify.
- Tagged by feature (`reminders`, `ai-description`, etc.) so we can
  filter noise quickly.
- Sampling: 100% errors, no perf transactions yet (perf goes to
  PostHog instead).

ADR: [decisions/0011-sentry-for-error-reporting.md](./decisions/0011-sentry-for-error-reporting.md)
(written in PR 3).

### PostHog (planned — PR 7)

- `posthog-js` for client analytics.
- Session-level event taxonomy (see PR 7's ADR for the full list).
- No PII; events are shape-only (`todo_created`, `reminder_enabled`,
  `backup_exported`, etc.).
- Self-host opt-out via Settings.

ADR: [decisions/0013-posthog-for-analytics.md](./decisions/0013-posthog-for-analytics.md)
(written in PR 7).

## What to watch for in production

A short list, not yet automated as alerts:

- **Spike in `error.tsx` activations** — surface area changed and
  something started throwing on mount.
- **Cron not running** — Vercel Cron is hobby-tier and silently skips on
  outages. Check `Vercel dashboard → Cron Jobs` history.
- **`reminder:*` keys piling up in Upstash without firing** — means the
  cron is hitting the route but failing past the auth step. Inspect
  Vercel function logs.
- **Push subscription failures** — `web-push` returns a 410 GONE when a
  subscription is dead. We don't currently delete on 410; should add to
  the cron once we have observability to confirm the pattern.

## How to debug a production issue today

1. Reproduce in Chrome DevTools with the production URL.
2. If client-side: open the Application tab → Service Workers, look at
   the cached responses. Sometimes the SW is serving stale shell.
3. If server-side: `vercel logs <deployment-url> --follow` (requires
   `vercel` CLI logged in).
4. If reminder-related: inspect Upstash directly via the dashboard. The
   `reminder:*` keys are JSON; you can grep `fireAt` to see what should
   be firing.

The Sentry PR will make most of step 1 unnecessary by tagging incidents
automatically.
