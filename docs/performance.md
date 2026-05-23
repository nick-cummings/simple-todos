# Performance

The app's perf budget is shaped by its target: a PWA installed on an
iPhone, loading over cellular sometimes, used in short bursts. First
paint matters; ongoing interactions need to feel instant.

## Current state

These are baselines. We don't have automated Lighthouse gating in CI
yet — that's a planned PR — so the numbers below are measured manually
in Chrome DevTools on a throttled connection (Fast 3G + 4x CPU) loading
production from Vercel.

| Metric               | Target       | Current (manual) |
| -------------------- | ------------ | ---------------- |
| LCP                  | < 2.5s       | ~1.8s            |
| CLS                  | < 0.1        | ~0               |
| TBT                  | < 200ms      | ~50ms            |
| JS shipped to client | < 200KB gzip | ~140KB gzip      |
| HTML size for `/`    | < 30KB       | ~18KB            |

These will become CI-enforced budgets in a later PR — see the open work
section below.

## Design decisions that shape perf

### Local-first means no waterfall

Reads from `localStorage` are synchronous. There's no fetch, no Suspense
fallback for the primary data path. The user's todos render on the first
client commit after hydration.

### No data fetching at the layout boundary

`src/app/layout.tsx` is a Server Component that emits the chrome and
hands off to `<TodoApp>` (Client Component). The HTML the user receives
is small and complete. No server round-trips to populate todos because
the server can't see them.

### Suspense boundary for `useSearchParams`

`/` wraps `<TodoApp>` in `<Suspense>` so the prerender can ship without
forcing the whole route to client-render. See
[ADR 0006](./decisions/0006-suspense-for-search-params.md).

### View Transitions API for visual continuity

Every state mutation that changes which todos are visible flows through
`withViewTransition(...)`. This is essentially free at runtime (the
browser handles the snapshot/crossfade) and dramatically improves the
"things feel solid" perception.

### Service Worker app-shell cache

The SW caches `/`, `/manifest.webmanifest`, `/_next/*`, and `/icons/*`.
Repeat visits render the shell before the network responds. Strategy is
network-first with cache fallback for navigations and cache-first for
static assets — sensible because the app shell can change but the user's
data lives in localStorage and is always fresh.

### `useSyncExternalStore` for store hooks

`useTodos` / `useLabels` use `useSyncExternalStore` so React 19 strict
mode doesn't double-trigger reads, and so cross-tab updates propagate
without re-renders we didn't ask for.

## Cost we pay

### Hydration cost on initial paint

The route is mostly Client Component, so the React JS bundle has to
parse and execute before anything is interactive. Mitigation: we keep
the bundle small (~140KB gzip) and lazy-load nothing — there's nothing
big enough to justify the routing complexity.

### View Transition pauses

When a state change kicks off a view transition, interaction is briefly
paused (~200ms) while the browser captures the before/after frames.
On low-power devices this can feel like input lag. We mitigate by only
wrapping changes that visibly move items.

## Open work

- **Lighthouse CI gate.** Planned PR 9. Will run `@lhci/cli` against
  production builds and fail the verify workflow if any of LCP, CLS,
  TBT, or JS bundle size regresses past budget.
- **Bundle inspection.** No automated tracking yet for individual
  client-component sizes. We'll add it alongside Lighthouse.

## How to measure right now

```sh
npm run build
npm run start              # production server on :3000
# Open Chrome DevTools → Lighthouse → Mobile + Slow 4G + 4x CPU
```

For a sharper read, run the Lighthouse CLI directly:

```sh
npx lighthouse http://localhost:3000 --view --preset=desktop
```
