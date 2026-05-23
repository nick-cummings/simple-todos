---
status: accepted
date: 2026-05-01
---

# 0002 — localStorage is the source of truth for user data

## Context

A todo app needs persistence. The canonical options are:

- A server-side database (Postgres / Mongo / etc.) keyed to a user account.
- A serverless KV store with a per-device identifier.
- The browser's `localStorage` / `IndexedDB`.
- A CRDT-backed sync layer (Yjs, Automerge) for multi-device.

The constraints in play:

- **Single user**: there is exactly one user (the author).
- **Free tier**: hosted on Vercel Hobby + Upstash free tier; budgets for
  bandwidth and request count are real.
- **Offline-first**: the PWA needs to be useful on a phone with patchy
  cell coverage.
- **Latency**: every interaction (toggle, edit, delete) should feel
  instant.
- **Privacy**: todos are personal; we'd rather they never leave the
  device.

## Decision

User data — todos, labels, theme, filter state — lives in `localStorage`
on the device. The server holds only the things that _fundamentally
cannot_ live on the device: Web Push subscription endpoints (the push
service needs to be able to reach the user when the device is asleep)
and the rate limiter for the AI endpoint.

Multi-device sync is intentionally not implemented. The export/import
JSON backup in Settings is the manual sync path.

## Alternatives considered

- **Server-side DB with auth.** Would add a meaningful auth surface
  (sessions, password reset, OAuth), require a hosted DB, double the
  ops surface, and add network latency to every read. The single-user
  constraint makes this overkill.
- **Per-device anonymous KV in Upstash.** Cheaper than a real DB but
  still adds a network round-trip to every read. Loses the
  offline-first property.
- **CRDT with localStorage + server replication.** Solves multi-device
  cleanly but adds significant complexity (conflict resolution, vector
  clocks, library overhead). Not justified for a one-user app.

## Consequences

- **Reads are synchronous and instant.** No spinners, no Suspense
  fallbacks for primary data.
- **Server can't see the user's data.** This is a privacy positive but
  means features like "search across devices" or "send me a weekly
  summary" are impossible without changing this decision.
- **One-device-at-a-time.** Switching from laptop to phone requires
  export-from-A, import-into-B. Backup is therefore a feature, not a
  nice-to-have. See [features/backup-and-restore.md](../features/backup-and-restore.md).
- **No server-side migration story.** If a localStorage schema change
  is ever needed, the migration has to run on the client at load time.
  The `:v1` suffix on keys gives us a forward path; we've never used it.
- **Quota is a real concern.** Safari caps `localStorage` around 5-10MB
  per origin. At several hundred todos we're nowhere close, but if the
  app grows to thousands a guard is needed.
  See [decisions/0012-localstorage-quota-handling.md](./0012-localstorage-quota-handling.md)
  (planned).

## References

- `src/lib/todos.ts`, `src/lib/labels.ts`, `src/lib/useTodos.ts`,
  `src/lib/useLabels.ts`
- Related: [ADR 0004](./0004-web-push-via-vapid.md) (why push subs _do_
  live server-side)
