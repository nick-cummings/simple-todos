# Error boundaries

Two React error boundaries that prevent a thrown render error from
blanking the app.

## What the user sees

A thrown render error in any component below `<TodoApp>` triggers
[`src/app/error.tsx`](../../src/app/error.tsx):

> **Something went wrong**
>
> The page hit an unexpected error. Your todos are stored in this
> browser and aren't affected — they'll still be there after a reload.
>
> Error reference: `abc123def`
>
> [Try again] [Reload page]

A thrown render error in the _root layout_ itself triggers
[`src/app/global-error.tsx`](../../src/app/global-error.tsx). The
global error component renders its own `<html>` / `<body>` because it
replaces the layout. It uses inline styles so a missing CSS bundle
can't blank the screen.

In both cases the user has two recovery paths:

- **Try again** — calls Next 16's `unstable_retry()` which re-fetches
  and re-renders the segment without a full reload. Best when the
  error was transient (e.g., a one-off render race).
- **Reload page** — calls `globalThis.location.reload()`. The
  fallback when retry doesn't help.

The digest (when present) is a Next-assigned hash of the error,
useful for matching client-side reports to server-side logs.

## What it catches

| Boundary           | Catches errors in                                   |
| ------------------ | --------------------------------------------------- |
| `error.tsx`        | Everything under `<TodoApp>` (i.e., the entire app) |
| `global-error.tsx` | The root layout + `error.tsx` itself if it throws   |

Neither catches:

- **Event handler errors.** React doesn't propagate these to
  boundaries. They throw and get logged via the existing console.
- **Async errors after the initial render** (e.g., a fetch handler
  throwing in a setState). These need to be caught at the call site
  or routed through a global handler. Sentry will fill this gap in
  PR 3.

## How it's tested

| Test                             | Layer       | What it covers                                                          |
| -------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `src/app/error.test.tsx`         | Unit        | All branches: Try again, Reload, digest display, console.error.         |
| Same file (boundary integration) | Integration | A real React Error Boundary catches a thrown child.                     |
| `src/app/global-error.test.tsx`  | Unit        | Same surface for the root-layout boundary's body (`<GlobalErrorBody>`). |

The root-layout boundary's UI is extracted into `<GlobalErrorBody>`
because happy-dom can't render `<html>/<body>` inside a test
container. The default export still wraps it in the html/body that
Next requires.

## Where logs go

Both boundaries call `Sentry.captureException(error, { tags:
{ boundary: ... } })` on mount, in addition to a `console.error` log
for in-process DevTools debugging. Sentry events are tagged:

- `boundary: page` for `error.tsx`
- `boundary: global` for `global-error.tsx`
- `runtime: browser` is added by the SDK init

Sentry's SDK no-ops if `NEXT_PUBLIC_SENTRY_DSN` is unset, so local
dev and preview deploys remain zero-cost. See
[ADR 0011](../decisions/0011-sentry-for-error-reporting.md) and
[observability.md](../observability.md).

## References

- Boundaries: `src/app/error.tsx`, `src/app/global-error.tsx`
- Tests: `src/app/error.test.tsx`, `src/app/global-error.test.tsx`
- Next docs:
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`
- Related: [observability.md](../observability.md),
  [ADR 0011](../decisions/0011-sentry-for-error-reporting.md)
