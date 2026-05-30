# Performance

The app's perf budget is shaped by its target: a PWA installed on an
iPhone, loading over cellular sometimes, used in short bursts. First
paint matters; ongoing interactions need to feel instant.

## Current state

Lighthouse CI gates the `verify` workflow against the budgets below
(see [`lighthouserc.json`](../lighthouserc.json) for the canonical
config and [ADR 0015](./decisions/0015-lighthouse-ci.md) for the
rationale). The numbers in the table below are production targets
measured manually in Chrome DevTools (Fast 3G + 4× CPU); the lhci
budgets are CI-enforced and may diverge slightly because headless
Chrome measures higher than DevTools.

| Metric              | CI budget | Production target (manual) |
| ------------------- | --------- | -------------------------- |
| LCP                 | ≤ 2.5s    | ~1.8s                      |
| CLS                 | ≤ 0.1     | ~0                         |
| TBT                 | ≤ 200ms   | ~50ms                      |
| Speed Index         | ≤ 3s      | n/a                        |
| JS shipped (script) | ≤ 256KB   | ~140KB gzip                |
| Total page weight   | ≤ 400KB   | ~200KB                     |
| Performance score   | ≥ 0.85    | ~0.95                      |
| Accessibility score | ≥ 0.95    | (now CI-enforced)          |
| Best Practices      | ≥ 0.90    | ~1.0                       |
| SEO                 | ≥ 0.90    | ~1.0                       |
| HTML size for `/`   | < 30KB    | ~18KB                      |

The assertions land in `warn` mode on the first PR (the issue's
explicit first-run plan); a follow-up tightens the perf/a11y/LCP/CLS
triad to `error` once 2–3 CI runs reveal stable values. See the ADR
for the observed local baselines.

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

- **Flip critical assertions to `error`.** The first PR lands all
  budgets in `warn` mode (see [ADR 0015](./decisions/0015-lighthouse-ci.md)).
  Once 2–3 CI runs confirm stable values, a follow-up flips
  `categories:performance`, `categories:accessibility`,
  `largest-contentful-paint`, and `cumulative-layout-shift` to
  `error`.
- **Investigate the CI CLS reading (~0.16).** Manual reads on
  production show ~0; headless Chromium measures higher. Suspects:
  theme bootstrap, font swap, Suspense commit. If the cause is real,
  fix the shift; if it's a headless-measurement artifact, document it
  in the ADR.
- **Bundle inspection.** No automated per-chunk size tracking yet.
  We'll add `@next/bundle-analyzer` alongside Lighthouse if the
  `resource-summary:script:size` signal turns out to be too coarse.

## How to measure locally

The CI-enforced way:

```sh
npm run test:lhci
```

Runs `@lhci/cli` against a local prod build on `http://localhost:4321`
exactly as CI does. Reports land in `.lighthouseci/` (gitignored).

For an ad-hoc DevTools read of production:

```sh
npm run build
npm run start              # production server on :3000
# Open Chrome DevTools → Lighthouse → Mobile + Slow 4G + 4x CPU
```

For a sharper CLI read against an arbitrary URL:

```sh
npx lighthouse http://localhost:3000 --view --preset=desktop
```
