---
status: accepted
date: 2026-05-22
---

# 0006 — Wrap `useSearchParams` consumers in `<Suspense>`

## Context

[ADR 0005](./0005-url-state-for-filters.md) put filter state in the
URL via `useSearchParams`. Next 16 has a specific requirement for this
hook:

> If a route is prerendered, calling `useSearchParams` will cause the
> Client Component tree up to the closest `Suspense` boundary to be
> client-side rendered.

Without a Suspense boundary above the consumer, the entire route is
forced to client-render, which both regresses initial paint and emits
a build-time warning.

`TodoApp` reads `useSearchParams` (for both filter state and the
`?todo=` deep-link). It's also the entire visible app on `/`.

## Decision

Wrap `<TodoApp>` in a `<Suspense>` boundary inside `src/app/page.tsx`.
The boundary has no visible fallback — `TodoApp` self-renders an
empty skeleton during the initial paint anyway, and adding a fallback
would just introduce a brief flash.

```tsx
export default function Home() {
  return (
    <Suspense>
      <TodoApp />
    </Suspense>
  );
}
```

## Alternatives considered

- **Move filter state out of the URL.** Reverses ADR 0005. Loses the
  reload/back-forward benefits.
- **Make `TodoApp` a Server Component.** Can't; it uses dozens of
  React hooks for state, refs, and effects.
- **Use a custom hook that wraps `useSearchParams` and falls back to
  default when null.** Doesn't actually fix the warning; Next still
  detects the call.
- **Push the Suspense boundary deeper, around just the filter UI.**
  Splits the data dependency unnecessarily; `TodoApp` reads search
  params at the top of the component, so the entire component
  belongs under the boundary anyway.

## Consequences

- **The `/` route prerenders the chrome only.** `layout.tsx` (with
  fonts, theme bootstrap, manifest) is static; `TodoApp` renders
  client-side. For a single-user app this is fine; LCP isn't bottlenecked
  on the chrome.
- **No Suspense fallback flash.** The boundary's fallback is empty
  (`<Suspense>` with no `fallback` prop). The first React render then
  paints the real UI.
- **Tests need a reactive `useSearchParams` mock.** See
  [ADR 0005](./0005-url-state-for-filters.md) consequences for the
  mock pattern.

## References

- `src/app/page.tsx`
- Next docs: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`
- Related: [ADR 0005](./0005-url-state-for-filters.md)
