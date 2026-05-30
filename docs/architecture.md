# Architecture

This is a single-user PWA. The author is the only user. That assumption
shapes nearly every decision: no auth, no multi-tenant data model, no
horizontal scaling concerns, and a free-tier hosting target.

## Topology

```
       ┌──────────────────────────┐
       │  iPhone (PWA, installed) │ ← primary surface
       └────────────┬─────────────┘
                    │ HTTPS
        ┌───────────▼──────────────┐
        │  Vercel (Next.js 16)     │
        │  ─────────────────────── │
        │  • App Router            │
        │  • /api/* edge/runtime   │
        │  • Vercel Cron (daily)   │
        └───────┬──────────┬───────┘
                │          │
        ┌───────▼──┐   ┌───▼──────────┐
        │ Upstash  │   │ Anthropic    │
        │ Redis    │   │ Messages API │
        │ (push +  │   │ (description │
        │  cron)   │   │  generation) │
        └──────────┘   └──────────────┘
```

Local-state-first. Every todo, label, and preference lives in the user's
browser via `localStorage`. The server holds _only_ the things that
fundamentally can't live in the browser: Web Push subscriptions, scheduled
reminder records, and the AI route's rate limiter.

## Data flow

### Read / write a todo

1. UI dispatches through hooks (`useTodos`, `useLabels`) which write to
   `localStorage` and notify subscribers via `useSyncExternalStore`.
2. No network round-trip. Reads are synchronous from in-memory cache.

### Filter state

Search query, label chips, status chips, and sort key live in the URL
(`?q=…&l=…&s=…&sort=…`) via `useFilterParams`. Reload, back/forward, and
deep-link all round-trip the view.

See [ADR 0005](./decisions/0005-url-state-for-filters.md).

### Notification deep-link

Push payload includes `?todo=ID`. The service worker either focuses an
already-open client and `postMessage`s the URL, or opens a new window.
`TodoApp` reads the param on mount, opens the matching todo, and clears
the param.

See [features/deep-link.md](./features/deep-link.md).

### Reminders pipeline

1. User creates a todo with a `dueDate`. The client computes a `fireAt`
   timestamp and POSTs a `ReminderRecord` to `/api/push/reminders`.
2. Vercel Cron hits `/api/push/notify-cron` daily at 15:00 UTC.
3. The cron scans `reminder:*` keys, sends Web Push for any past
   `fireAt`, then deletes the record.
4. The service worker shows the notification; tapping it deep-links to
   the todo.

See [features/reminders.md](./features/reminders.md).

### AI description generation

User clicks "AI" on a new todo. The client calls `/api/generate-description`
with the title plus best-effort geolocation (used to flavor the suggestion,
e.g., weather references for "go for a run"). The route is rate-limited
via Upstash and calls the Anthropic Messages API.

## Storage

### Client (localStorage)

| Key                               | Shape               | Owner                     |
| --------------------------------- | ------------------- | ------------------------- |
| `simple-todos:v1`                 | `Todo[]`            | `src/lib/todos.ts`        |
| `simple-todos:labels:v1`          | `Label[]`           | `src/lib/labels.ts`       |
| `simple-todos:theme`              | `"light" \| "dark"` | `src/lib/theme.ts`        |
| `simple-todos:browserId`          | `string`            | `src/lib/useReminders.ts` |
| `simple-todos:reminders:prompted` | `"1"`               | `src/lib/useReminders.ts` |

The `:v1` suffix gives us a migration lane if a schema ever needs to
change. We've never had to use it.

All writes flow through `safeWrite` in `src/lib/storage.ts`, which
catches `QuotaExceededError`, reports to Sentry, and triggers an
in-app banner via the `useStorageError` hook. See
[ADR 0012](./decisions/0012-localstorage-quota-handling.md) and
the [data-loss runbook](./operations/runbook-data-loss.md).

### Server (Upstash Redis)

| Key pattern                      | Shape                       | TTL     |
| -------------------------------- | --------------------------- | ------- |
| `subscription:<browserId>`       | `PushSubscriptionRecord`    | none    |
| `reminder:<reminderId>`          | `ReminderRecord`            | none    |
| `rate:generate-description:<ip>` | `@upstash/ratelimit` window | sliding |

Flat string keys, no sets/hashes. Volume is single-user-tiny.

## Runtime model

- **Rendering**: App Router, mostly Client Components (the app is highly
  interactive; SSR would add complexity without payoff for a single-user
  app). `page.tsx` for `/` wraps `TodoApp` in `<Suspense>` so
  `useSearchParams` doesn't trip the prerender bailout —
  see [ADR 0006](./decisions/0006-suspense-for-search-params.md).
- **State**: hooks back onto `useSyncExternalStore` so React 19's
  strict-mode-friendly mounting doesn't double up `localStorage` reads.
- **View transitions**: every list mutation flows through
  `withViewTransition(...)` to animate via the View Transitions API.

## Build & deploy

- `npm run build` produces the production bundle.
- Vercel deploys on push to `main`.
- Infrastructure (env vars, cron schedule, secrets) lives in `infra/*.tf`
  and is `terraform apply`ed from a local checkout.
- `.env*` and `infra/*.tfvars` are gitignored. Real secrets go through
  Terraform → Vercel project env vars.

See [operations/deploy.md](./operations/deploy.md).

## Design mockups (dev-only)

The `/mockups/*` routes (`labels`, `label-picker`, `reminders`,
`undo-toast`, `recurring`, `voice`) host unfinished design mockups backed by
large mock components under `src/components/mockups/`. They render in local dev
and on Vercel preview deploys but **404 in production** — they're
unfinished UI we don't want exposed publicly. The check is centralized in
`mockupsEnabled()` (`src/lib/mockupsEnabled.ts`): each `page.tsx` calls
`notFound()` when it returns false. The gate prefers `VERCEL_ENV` (so
preview deploys keep the mockups) and falls back to `NODE_ENV`. Because
these are statically-prerendered server components, the gate is resolved
at **build time, per deploy** from that deploy's `VERCEL_ENV` (the
production build bakes in the 404; a preview build bakes in the mock) —
not a per-request runtime check. The mockups still ship in the bundle;
they're just unreachable on the production deploy.

## What's deliberately not here

- **No auth.** Single user. Adding auth would change the storage model
  fundamentally; see [ADR 0002](./decisions/0002-localstorage-as-source-of-truth.md).
- **No background sync / multi-device merge.** localStorage is per-browser.
  The backup export/import is the manual sync path.
- **No SSR-rendered todo data.** Server can't see the user's todos
  (intentionally — they never leave the device).
