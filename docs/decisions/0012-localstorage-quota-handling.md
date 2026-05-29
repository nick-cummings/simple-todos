---
status: accepted
date: 2026-05-23
---

# 0012 — localStorage quota: catch + surface, don't pre-empt

## Context

[ADR 0002](./0002-localstorage-as-source-of-truth.md) put user data
in `localStorage`. That gave us synchronous reads, offline-first
behavior, and a zero-server-cost storage layer. The trade-off it
flagged at the bottom of the consequences list:

> **Quota is a real concern.** Safari caps `localStorage` around
> 5-10MB per origin. At several hundred todos we're nowhere close,
> but if the app grows to thousands a guard is needed.

A real failure looks like this: `setItem` throws `QuotaExceededError`,
the call site doesn't catch it, the React state mutation that
preceded it stays in-memory, the user keeps editing, and on the next
reload everything since the last successful write is gone. Silent.

Three places this could happen today:

- `saveTodos` (every CRUD mutation on the todo list)
- `saveLabels` (less frequent; the label registry is smaller)
- `writeBackupToStorage` (a one-off but with high stakes — the user
  just imported a backup)

## Decision

A single quota-aware write wrapper, `safeWrite`, lives in
`src/lib/storage.ts`. Every existing `localStorage.setItem` for app
data routes through it. On failure it:

1. Catches the exception so the caller doesn't crash.
2. Returns `false` so callers that can react (e.g. import
   confirmation) branch on it.
3. Reports to Sentry tagged `area: storage`, `code: quota_exceeded`,
   `key: <which key>`.
4. Notifies a global pub/sub of listeners.

A new `useStorageError` hook subscribes to the pub/sub and exposes
the latest failure as React state. `TodoApp` renders a
`<StorageErrorBanner>` above the todo list when state is non-null.
The banner is `role="alert"` so screen readers announce it, links
to `/settings` (export + clear) as the recovery path, and is
dismissible.

We deliberately do **not** pre-empt by polling
`navigator.storage.estimate()`. That API is patchily supported on
Safari (the target platform) and the recovery path is identical
either way: tell the user to export and clear. Reactive is enough.

## Alternatives considered

- **Auto-archive completed todos older than N days.** Tempting —
  silently keeps the app usable — but introduces data movement the
  user didn't initiate, and the threshold ("older than N days") is a
  product decision we don't have signal to make. If the user later
  wants their completed history, they'd find it mysteriously gone.
- **Throw, let an error boundary catch it.** The page-level boundary
  would render the "something went wrong" UI, which is far worse
  UX for a recoverable condition than an in-place banner.
- **Show a modal that blocks interaction.** Aggressive. The user
  might be mid-edit; let them keep editing in memory while they
  decide what to do.
- **Use IndexedDB instead.** Much larger quotas, no synchronous API.
  Forces every read path to become async or to cache through a
  separate layer. Significant rewrite for a problem we don't have
  yet (the author has dozens of todos, not thousands).

## Consequences

- **Every existing write now returns `boolean`.** Most callers
  ignore it. Settings's `confirmImport` branches on it to surface a
  "partial import" message in addition to the global banner.
- **Sentry sees every quota event.** Tags include `key`, so we can
  tell whether todos or labels filled the cap first. If this fires
  in practice we'll have a real signal to decide whether to add the
  auto-archive feature.
- **Banner pattern is reusable.** Any future write that goes through
  `safeWrite` automatically participates in the banner — no extra
  wiring per call site.
- **Test pattern: spy on `localStorage.setItem` selectively.** Tests
  install a `vi.spyOn(localStorage, "setItem")` that throws
  `QuotaExceededError` only when the key matches the target write
  (e.g. `simple-todos:v1`), letting unrelated keys (theme,
  browserId, etc.) write through so the rest of the app still
  mounts cleanly.
- **Non-app-data writes route through `safeWrite` too, for
  consistency.** The original wrapper targeted the three app-data
  writes above, but ancillary keys were still calling
  `localStorage.setItem` raw and would throw `QuotaExceededError`
  unhandled. As of this consistency pass, all three also flow through
  `safeWrite`:
  - `useTheme` — `THEME_KEY` (the `setTheme` persistence write; the
    pre-paint inline script in the layout only *reads* the key, so it
    is not affected).
  - `useReminders` — `PERMISSION_PROMPTED_KEY` and `BROWSER_ID_KEY`.
    These are best-effort: the hooks keep working on the in-memory
    value for the session if the write fails (a fresh `browserId` is
    minted next load). They are not the same stakes as losing todo
    data, but routing them through `safeWrite` means a quota event
    still reports to Sentry and surfaces the banner rather than
    crashing the caller. No write outside `safeWrite` remains.

## References

- `src/lib/storage.ts` — `safeWrite`, `subscribeToStorageErrors`
- `src/lib/useStorageError.ts` — React hook
- `src/components/StorageErrorBanner.tsx` — UI
- Callers: `src/lib/todos.ts → saveTodos`,
  `src/lib/labels.ts → saveLabels`,
  `src/lib/backup.ts → writeBackupToStorage`,
  `src/lib/useInstallPrompt.ts → dismiss`,
  `src/lib/useTheme.ts → setTheme`,
  `src/lib/useReminders.ts → enable` (prompted flag) and
  `ensureBrowserId` (browserId)
- Runbook: [`docs/operations/runbook-data-loss.md`](../operations/runbook-data-loss.md)
- Related: [ADR 0002](./0002-localstorage-as-source-of-truth.md),
  [ADR 0011](./0011-sentry-for-error-reporting.md) (Sentry tagging)
