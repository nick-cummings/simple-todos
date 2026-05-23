---
status: accepted
date: 2026-05-23
---

# 0009 — Playwright in CI: 4 workers + official container

## Context

After adding several features (reminders, URL state, settings,
backup), the Playwright suite grew to 86 tests across two projects
(`chromium-desktop` + `mobile-iphone`). On the initial CI config
(`workers: 1` to avoid flakes, `next dev` test server,
`actions/cache`-based browser caching), the E2E step took 290s — five
times longer than the same suite ran locally.

The job was bottlenecked on two things:

1. **Single-worker serial execution.** `ubuntu-latest` is a 4-core
   runner; running tests serially wasted three of those cores.
2. **`next dev` JIT compile cost.** Every new route compiles on first
   request in dev mode, adding to per-test latency.
3. **`apt-get install-deps` for Playwright system libraries.** Took
   ~34s on every run because the apt packages can't be cached via
   `actions/cache` (they live outside the runner's HOME).

## Decision

Three changes, applied incrementally and measured along the way:

1. **`workers: 4` in CI** (`playwright.config.ts`). Matches the runner
   core count. Suite was stable at 4 workers locally; no flake regressions
   in CI either.
2. **`next dev` → `next build && next start`** in the test server
   (`package.json` → `start:test`). Production build amortizes the
   compile cost upfront once, instead of per-test.
3. **Run the CI job inside `mcr.microsoft.com/playwright:v1.60.0-noble`.**
   The image ships browsers + every apt system dep preinstalled.
   Drops the `install-deps` step entirely.

The image tag is pinned to the same version as `@playwright/test` —
bump them together.

## Alternatives considered

- **More aggressive parallelism (workers: 8 or `os.cpus()`).** Runner
  only has 4 cores; over-subscribing causes scheduler contention,
  not more throughput. Made it worse in a quick test.
- **Test sharding across multiple CI jobs.** Halves wall-time but
  doubles billed minutes and adds artifact-merging complexity. Worth
  doing later if test count balloons.
- **Drop the WebKit project.** Most tests run on both Chromium and
  WebKit; cutting WebKit would halve the suite. But the app's primary
  surface is iOS Safari, and WebKit catches platform-specific bugs
  Chromium misses. Not worth losing.
- **Keep `next dev`.** Saves the build-once-per-CI cost (~20s) but
  gives back ~20-30s in per-route compile delays during the run.
  Roughly net-neutral on time, plus prod-mode tests reproduce real
  user behavior more closely.

## Consequences

- **CI E2E step time: 290s → 149s.** Total job: 6m26s → 4m26s.
- **Two new test environment requirements:**
  - Service worker must be disabled in the test build, because the
    combination of WebKit, a registered SW, and Playwright's
    `page.route()` mocked POSTs interacts badly. See
    [ADR 0010](./0010-disable-sw-in-playwright.md).
  - Geolocation is granted up-front in `playwright.config.ts` so the
    AI feature's `getCurrentPosition` resolves instantly.
- **Image version drift risk.** If the `@playwright/test` package
  version moves and the image tag doesn't (or vice versa), browser
  versions can mismatch. The release process: update both in the
  same PR, or skip the container override and fall back to the
  apt-deps install path.
- **Playwright config now needs `permissions: ["geolocation"]` and a
  default geolocation** — visible in the diff and worth knowing about
  if someone wonders why the AI tests don't hang.

## References

- `playwright.config.ts`, `.github/workflows/verify.yml`,
  `package.json` (`start:test`)
- Related: [ADR 0010](./0010-disable-sw-in-playwright.md)
- Image: <https://mcr.microsoft.com/en-us/product/playwright/about>
