---
status: accepted
date: 2026-05-23
---

# 0011 — Sentry for error reporting

## Context

[observability.md](../observability.md) inventoried what we had:
console-only logging on both the client and server. On the author's
iPhone PWA — the actual production target — console output is
invisible unless Safari DevTools is attached. Anything that throws in
production was silent.

We need a remote error sink with three properties:

1. **It catches both client and server errors.** A todo app's failure
   modes span both surfaces; a sink that only sees one would miss
   half.
2. **It costs nothing for a one-user app.** Free-tier limits need to
   be generous enough that normal use doesn't approach them.
3. **It works without sustained operational investment.** No
   self-hosted infra to keep alive, no schema to maintain.

## Decision

Sentry, on the free tier ("Developer plan"). The
`@sentry/nextjs` SDK is the official integration; it wires up the
client SDK, server SDK, edge SDK, source map upload, and Next 16's
`instrumentation.ts` / `onRequestError` hook with a single
`withSentryConfig` wrapper.

Free tier provides 5K errors / month, source maps, alerting, and team
of one. Plenty of headroom for one user.

Tagging conventions:

- All events tagged with `runtime` (`browser` | `nodejs` | `edge`).
- Page-level boundary captures tagged `boundary: page`.
- Root-layout boundary captures tagged `boundary: global`.
- Cron push failures captured with `area: push-cron`,
  `reminderId: <id>`, `statusCode: <int>`.

Sentry events are routed through `/monitoring` (the SDK's
`tunnelRoute` option) so ad-blockers don't drop them.

We turn off perf monitoring (`tracesSampleRate: 0`) and session
replay — those domains are PostHog's (planned PR 7) or already
covered by Vercel's built-in metrics.

## Alternatives considered

- **Slack webhook.** Easy to set up but loses every Sentry feature
  that matters: stack trace deminification, grouping, breadcrumb
  context, alert thresholds. Replaces a structured tool with an
  unstructured stream. Discussed and rejected at planning time.
- **Self-hosted Sentry / GlitchTip.** Sentry is open source; we
  could run it on a Hetzner box. Trade $0/month for ~$5/month + the
  ongoing ops cost of keeping it patched. Not worth it for a single
  app.
- **Vercel Log Drains to a custom collector.** Works for server-side
  errors only. Doesn't catch client errors at all. Half-solution.
- **No remote reporting; rely on user reports.** Tried; the author
  forgets to look. Real errors went unnoticed until they recurred.

## Consequences

- **`@sentry/nextjs` adds ~14KB gzip to the client bundle.** We
  measured it; acceptable. The SDK runs only when DSN is set, so
  preview deploys and local dev have zero cost.
- **`withSentryConfig` modifies the build.** Source maps get
  uploaded to Sentry when `SENTRY_AUTH_TOKEN` is present. Without
  the token, the build still succeeds but maps stay local — Sentry
  events will show minified stack traces in that case.
- **The DSN is `NEXT_PUBLIC_*`.** The client needs to see it to
  initialize the SDK. This is by design; the DSN is a write-only
  endpoint URL, not a credential. Sentry rate-limits per project.
- **New env vars to set in Vercel:**
    - `NEXT_PUBLIC_SENTRY_DSN` — required at build + runtime
    - `SENTRY_AUTH_TOKEN` — build-time only, for source map upload
    - `SENTRY_ORG`, `SENTRY_PROJECT` — build-time only
    - **`SENTRY_ORG` must be the slug, not the display name.** Sentry's
      UI shows the human-readable org name ("Nick Cummings") but
      `withSentryConfig`'s source-map upload — and Sentry's API — both
      expect the slug (`nick-cummings`). The DSN has the org _ID_ baked
      in so runtime captures work either way; only source-map upload
      breaks silently with the wrong value.
- **`/monitoring` route now exists.** It's the SDK's tunnel route;
  Sentry's webpack plugin creates the handler at build time. Don't
  use that path for anything else.
- **Server-side errors auto-capture via `onRequestError`** in
  `src/instrumentation.ts`. We don't have to wrap individual API
  routes; the Next instrumentation hook plus `Sentry.captureRequestError`
  catches them all.
- **Per-push failures in the cron are captured as `warning`-level
  messages.** Each one carries enough tags (reminderId, statusCode)
  to debug without the actual reminder payload. Useful when devices
  go offline mid-cron run.
- **Test pattern: hoisted `vi.mock`.** Sentry's namespace import
  pattern combined with Vitest's hoisted mock factories requires
  `vi.hoisted` to share the spy with the mock factory. This pattern
  is used in `src/app/error.test.tsx`,
  `src/app/global-error.test.tsx`, and
  `src/app/api/push/notify-cron/route.test.ts`.

## References

- SDK init: `src/instrumentation.ts`, `src/instrumentation-client.ts`,
  `sentry.server.config.ts`, `sentry.edge.config.ts`
- Build wrapper: `next.config.ts`
- Capture points: `src/app/error.tsx`, `src/app/global-error.tsx`,
  `src/app/api/push/notify-cron/route.ts`
- Related: [observability.md](../observability.md),
  [features/error-boundaries.md](../features/error-boundaries.md)
- Sentry Next docs: <https://docs.sentry.io/platforms/javascript/guides/nextjs/>
