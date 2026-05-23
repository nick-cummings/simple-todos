---
status: accepted
date: 2026-05-23
---

# 0010 — Disable the service worker in the Playwright test build

## Context

When the Playwright test server switched from `next dev` to `next
build && next start` (see [ADR 0009](./0009-playwright-container-and-workers.md)),
two of the existing AI-description E2E tests started failing on the
`mobile-iphone` (WebKit) project:

```
× ai-description.spec.ts > populates the description field from a
                            mocked API success
× ai-description.spec.ts > shows an inline error message when the API
                            returns 429
```

Both tests use `page.route("**/api/generate-description", ...)` to
fulfil the response without hitting Anthropic. The mocks worked fine
in Chromium and worked fine in dev mode. They only broke under WebKit

- production build.

The trigger was that `ServiceWorkerRegister` only mounts the SW in
production (`NODE_ENV === "production"`), so `next dev` had no SW
running. Under prod build the SW _was_ registered, and WebKit's
ordering of `page.route` interception versus the SW's involvement in
the fetch pipeline made the mocks unreliable for POST requests —
even though the SW's `fetch` handler returns early for non-GETs.

This is a known Playwright + WebKit + Service Worker interaction; the
SW being installed at all changes how requests are seen at the test
boundary.

## Decision

The Playwright test build runs with the service worker disabled. A
build-time flag `NEXT_PUBLIC_DISABLE_SW=1` is set in `start:test`, and
`ServiceWorkerRegister` checks it before registering.

```tsx
if (process.env.NEXT_PUBLIC_DISABLE_SW === "1") return;
```

The flag has no effect in normal production deploys, where the var is
unset.

SW behavior (cache strategy, push handler, notification click) is
covered by unit tests against `public/sw.js`, not by E2E.

## Alternatives considered

- **Mock at a lower level (network).** Playwright's `route` is already
  the network layer; the issue is upstream of that.
- **Skip the AI tests on WebKit.** Hides a real test, doesn't fix the
  interaction.
- **Use `playwright.config`'s `serviceWorkers: "block"`.** This
  prevents SW _installation_ but the existing SW in cache could still
  participate. The build-time flag is simpler and more deterministic.
- **Always register the SW; teach the tests to wait for it.** Adds
  flakiness; the SW's install/activate lifecycle is async and racy
  under test.

## Consequences

- **One environment variable, well-scoped.** The opt-out only fires in
  the Playwright test build. Production deploys are unaffected.
- **The flag is `NEXT_PUBLIC_` because the check happens client-side.**
  Inlined into the build bundle; no server runtime dependency.
- **SW coverage shifts to unit tests.** Service worker behavior (cache
  strategy, push payload parsing, notification click message
  passing) is exercised in unit tests, not E2E. This is a reasonable
  trade — SW tests under headless WebKit have always been a pain.
- **Future SW changes still need manual verification.** Whenever
  `public/sw.js` changes meaningfully, smoke-test the installed PWA
  manually on the actual device.

## References

- `src/components/ServiceWorkerRegister.tsx`
- `package.json` → `start:test`
- Related: [ADR 0009](./0009-playwright-container-and-workers.md)
