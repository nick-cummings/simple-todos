---
status: accepted
date: 2026-05-22
---

# 0005 — Filter state lives in the URL

## Context

The app has four orthogonal filter dimensions:

- A free-text search query (`q`)
- Active label chips (`l`)
- Active status chips (`s`: open / done)
- Sort key (`sort`)

Before this change, all four lived in component-local `useState`. A
reload, a deep-link share, or a back/forward gesture all lost the
view. That's a small papercut individually but compounds: every time
the author hit refresh on iOS Safari (a frequent gesture), the filter
state evaporated.

## Decision

Filter state lives in the URL as search params. A dedicated hook,
`useFilterParams`, reads from `useSearchParams` and exposes setters
that call `router.replace`. The component treats the URL as the single
source of truth; there's no local copy.

URL contract:

```
?q=<text>                  search query (omitted when empty)
?l=<a>,<b>,<c>             active labels (omitted when empty)
?s=open|done|open,done|""  status chips; omitted = "open only" (default);
                           empty string = "explicitly nothing"
?sort=<SortKey>            omitted = createdDesc (default)
```

Default values are omitted from the URL to keep `/` clean for the
common case.

## Alternatives considered

- **Keep local state, snapshot to URL on demand.** Adds the
  reload-loses-state bug back. Half-measure.
- **Sync local state to URL via a one-way effect.** Common pattern but
  prone to race conditions when the URL changes via back/forward.
  Treating the URL as the source of truth dodges this entirely.
- **Encode state into the path (e.g. `/search/coffee/labels/work`).**
  More verbose, doesn't compose cleanly with the deep-link `?todo=ID`
  param, and Next would need explicit route segments.

## Consequences

- **Every filter interaction triggers a `router.replace`.** Cheap (no
  network), but the search input's onChange does it on every
  keystroke. We accept this; for an app with <100 todos the cost is
  invisible.
- **The `?todo=` deep-link param is preserved across filter changes**
  because `update()` merges into the existing `URLSearchParams`.
- **Test setup is non-trivial.** `useSearchParams` is a read-only
  hook; mocking it requires a reactive store so `router.replace` re-
  renders the consumer. `TodoApp.test.tsx` and
  `useFilterParams.test.ts` both use a `useSyncExternalStore`-backed
  mock.
- **Forces a Suspense boundary above `TodoApp`.** Next requires
  consumers of `useSearchParams` to live under `<Suspense>` so the
  rest of the route can prerender. See
  [ADR 0006](./0006-suspense-for-search-params.md).

## References

- `src/lib/useFilterParams.ts`, `src/lib/useFilterParams.test.ts`
- Component integration: `src/components/TodoApp/index.tsx`
- Related: [ADR 0006](./0006-suspense-for-search-params.md)
