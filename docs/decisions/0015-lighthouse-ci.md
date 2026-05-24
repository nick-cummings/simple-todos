---
status: accepted
date: 2026-05-24
---

# 0015 — Gate the verify workflow on Lighthouse budgets

## Context

[`docs/performance.md`](../performance.md) tracks performance targets
(LCP, CLS, TBT, JS shipped, page weight) and has historically been
measured manually in Chrome DevTools. That means regressions only get
caught when someone happens to look — which, in a solo project, is
"sometimes never."

The app is a mobile-first PWA. The user surface that matters is iOS
Safari over cellular, where every kilobyte of JavaScript and every
hundred milliseconds of LCP is felt. Letting a regression slip into
`main` because nobody ran Lighthouse that day is the failure mode
we want to close.

Lighthouse CI (`@lhci/cli`) is the well-trodden way to run Lighthouse
in CI and assert against budgets. It plugs into our existing
`verify` pipeline without standing up a separate service.

## Decision

Add Lighthouse CI to the `verify` workflow as a gate on perf,
accessibility, best-practices, and SEO. Budgets are codified in
[`lighthouserc.json`](../../lighthouserc.json) and assert against
3 runs at the median value, mobile preset, against `npm run
start:test` on `http://localhost:4321`.

### Budgets

The numbers below were chosen ~10–15% above the manual baseline in
[`docs/performance.md`](../performance.md), so normal Lighthouse
run-to-run noise doesn't flap but a real regression gets caught.

| Audit                          | Budget    | Source / rationale                                                     |
| ------------------------------ | --------- | ---------------------------------------------------------------------- |
| `largest-contentful-paint`     | ≤ 2500 ms | Standard "good" threshold; manual baseline ~1.8s on production.        |
| `cumulative-layout-shift`      | ≤ 0.1     | "Good" threshold; we don't have shifting content by design.            |
| `total-blocking-time`          | ≤ 200 ms  | "Good" threshold; loose enough that Sentry/PostHog init don't trip it. |
| `speed-index`                  | ≤ 3000 ms | Loose; catches egregious regressions only.                             |
| `resource-summary:script:size` | ≤ 256 KB  | Generous headroom over the manual ~140 KB gzip baseline.               |
| `total-byte-weight`            | ≤ 400 KB  | Same headroom logic.                                                   |
| `categories:performance`       | ≥ 0.85    | Loose floor; the individual metrics are the real gates.                |
| `categories:accessibility`     | ≥ 0.95    | Enforces the a11y work tracked under issue #9.                         |
| `categories:best-practices`    | ≥ 0.90    | Generous; lets us experiment with deps that ding it.                   |
| `categories:seo`               | ≥ 0.90    | Largely irrelevant for an installed PWA but cheap to keep.             |

### Land-in-warn-first

All assertions ship in `warn` mode in this first PR, even though the
intended end state is `error` for the perf/a11y/LCP/CLS triad. The
issue's first-run rationale (and the LHCI docs' default advice) is:

> Run the suite locally before turning the assertions on in CI,
> otherwise the first CI run will fail and block all subsequent
> merges. The configuration should land in `warn` mode initially,
> then flip to `error` once verified.

Local measurement against the `start:test` build (headless Chromium,
simulated Slow 4G + 4× CPU, screen `mobile` preset) found three
budgets _currently exceeded_:

- **LCP** ~3.3s vs 2.5s budget — headless Chrome measures LCP higher
  than the DevTools production read. See gotcha below.
- **CLS** 0.16 vs 0.1 budget — surprising; the manual baseline is ~0.
  Plausible causes: theme bootstrap script, font swap, or
  `Suspense` boundary commit. Investigate before tightening.
- **Script bytes** ~271 KB vs 256 KB budget — close, likely uncompressed
  size vs the manual gzipped read. Re-measure under brotli/gzip.

The follow-up PR (after 2–3 CI runs reveal real CI variance) tightens
the assertions to `error` for the metrics that consistently pass and
leaves the others either in `warn` mode or addresses the underlying
regression.

### Why mobile-only

The app's primary surface is the iPhone. If mobile passes, desktop
will pass — they have the same JS bundle and the desktop preset has
laxer throttling. Adding a desktop run would double CI cost for
information that's strictly less interesting than mobile. Defer.

### Why no LHCI server

`@lhci/cli` can ship results to an LHCI server for historical trend
tracking. That requires a separate persistent service. Defer until
we actually want trend data — the per-run report uploaded as a CI
artifact is enough for diff'ing.

## Alternatives considered

- **`size-limit` instead of Lighthouse.** Cheaper (only measures bundle
  size) but doesn't catch LCP/CLS/TBT/accessibility regressions.
  Complementary, not a replacement; add later if Lighthouse-CI's
  bundle-size signal turns out to be too noisy.
- **`@next/bundle-analyzer` in CI.** Useful for diffing chunk sizes
  but produces a report, not a gate. Could pair with this later.
- **A separate scheduled workflow** (nightly) instead of gating each
  PR. Faster PRs at the cost of "the bad commit landed yesterday and
  has been on main for 18 hours." Going with PR-gating is the whole
  point — catch it before merge.
- **Custom Lighthouse runner script.** More flexible than `@lhci/cli`
  but rewrites infrastructure that's already production-grade. Not
  worth it.
- **Multi-URL audit** (`/` + `/settings`). Defer; the home route owns
  the JS bundle and the user's first-impression metrics. `/settings`
  isn't the hot path.

## Consequences

- **CI gains ~30–60s per run** for the build + 3 Lighthouse runs.
  Total `verify` job goes from ~4-5 min to ~5-6 min. Free on the
  GitHub Actions tier, acceptable for the regression coverage.
- **Lighthouse needs Chrome available** in the runner. The verify
  job already runs in the `mcr.microsoft.com/playwright` container,
  which ships Chromium under `/ms-playwright/chromium-*/chrome-linux/chrome`.
  The workflow exports `CHROME_PATH` to that location before invoking
  `lhci`. Bumping the image tag in
  [`.github/workflows/verify.yml`](../../.github/workflows/verify.yml)
  bumps the Chromium version Lighthouse measures with too.
- **The `start:test` build runs twice per CI run** — once for
  Playwright, once for `lhci autorun`'s `startServerCommand`. The
  `.next/cache` GitHub Actions cache amortizes the second build to
  ~10 s. Acceptable.
- **Headless Chrome metrics differ from real devices.** Especially LCP
  and TBT. Budget against CI-measured values, not the DevTools
  numbers in [`docs/performance.md`](../performance.md). The numbers
  in that file are the production targets; the lhci budgets are the
  CI gates and may diverge.
- **Reports upload as a CI artifact (`lighthouse-report`)** on every
  run, retained 14 days. Use it to diff metrics when a budget fails
  — open the HTML report in the artifact, find the audit, read the
  trace.
- **`numberOfRuns: 3` + median aggregation** dampens the typical
  ±3-5 point run-to-run Lighthouse score variance. Single-run
  assertions would flap; 3-run median is the documented mitigation.
- **Sentry/PostHog future weight**. If PostHog ships (issue #8), the
  JS budget will need to absorb ~30 KB more. Either land Lighthouse
  last in the sequence, or bump the JS budget proactively when
  PostHog lands.

## References

- Config: [`lighthouserc.json`](../../lighthouserc.json),
  [`package.json`](../../package.json) (`test:lhci` script),
  [`.github/workflows/verify.yml`](../../.github/workflows/verify.yml)
- Performance baseline: [`docs/performance.md`](../performance.md)
- Related ADRs:
  [0009 — Playwright in CI](./0009-playwright-container-and-workers.md)
  (the container Lighthouse reuses),
  [0010 — Disable the service worker in Playwright](./0010-disable-sw-in-playwright.md)
  (the `start:test` env vars Lighthouse also inherits)
- LHCI getting started:
  <https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md>
- LHCI assertions reference:
  <https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md#assertions>
