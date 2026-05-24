# Testing

## Layers

Three layers, in order of cost and confidence:

| Layer       | Tool                           | Where it lives                 | What it proves                                                |
| ----------- | ------------------------------ | ------------------------------ | ------------------------------------------------------------- |
| Unit        | Vitest + happy-dom             | `src/lib/*.test.ts`            | A pure function does what it says.                            |
| Integration | Vitest + Testing Library       | `src/components/**/*.test.tsx` | A component wired to its hooks behaves correctly for a user.  |
| E2E         | Playwright (Chromium + WebKit) | `tests/e2e/*.spec.ts`          | The deployed app, viewed in a real browser, works end-to-end. |

## Philosophy

### Test the wiring, not just the units

The single most important lesson here:

> When a feature splits into "hook does the work + component calls the
> hook," unit tests on both sides can pass while the wiring silently
> breaks. The integration test on the seam is the one that catches the
> real bug.

This is captured for future selves in
[ADR 0008](./decisions/0008-integration-tests-on-the-wiring-seam.md). The
canonical incident was the reminders rollout, where two bugs shipped to
production despite the new test coverage:

1. The reminders hook captured a stale `todos` closure via
   `queueMicrotask`, so newly-added todos never registered for reminders.
2. There was no initial sync when reminders activated for existing todos.

Both bugs lived in the wiring between `TodoApp` and `useReminders`. The
fix added integration tests that mock the hook and assert the component
calls it correctly (`expect(syncTodoReminder).toHaveBeenCalledWith(...)`).

The rule of thumb: if a feature description contains "and then X tells Y
to do Z", there should be a test that asserts the X-tells-Y call pattern,
not just tests for X's logic and Y's logic in isolation.

### Don't just test the happy path

Each new feature needs:

- Happy path
- The two or three most-likely edge cases (empty input, malformed input,
  invalid state, race conditions)
- The "what does the user see if this fails?" path

Tests are cheap and the suite is fast (456 unit tests run in ~2s). Err
toward more coverage.

### Per-suite locality

Tests live next to the code they test, not in a global `__tests__/`
directory. The exception is Playwright E2E, which lives in `tests/e2e/`
because it tests deployed behavior, not unit-level behavior.

## Running

```sh
npm test               # vitest watch mode
npm run test:run       # vitest one-shot with coverage
npm run test:e2e       # playwright across both projects
npm run verify:static  # format + typecheck + lint (~5s)
npm run verify:fast    # verify:static + unit tests (~10s, no E2E)
npm run verify         # the full pre-push gate: verify:fast + e2e (~5min)
```

Iterate locally with `verify:fast`. Run the full `verify` once when
you're done — it's slow enough that you don't want to wait on E2E
during every save. The Claude implementer agent follows the same
discipline.

CI runs `verify`. The pre-push Husky hook also runs `verify`. Both gates
must be green before code lands on `main`.

## Coverage thresholds

Configured in `vitest.config.ts`. We set them deliberately just below the
current measured numbers so that any meaningful regression breaks the
build, but routine edits don't flap. Bump them up when a wave of new
tests lands.

## Mocking

- `localStorage` is real (happy-dom provides it); we clear it in
  `beforeEach`.
- `next/navigation` is mocked with a reactive `useSyncExternalStore`-backed
  store in `TodoApp.test.tsx` so `router.replace` triggers re-renders the
  way the real one does. Without that, filter-URL tests would race the
  stale render.
- External APIs (Anthropic, Web Push) are mocked at the `fetch` level.
- The service worker is disabled in the Playwright test build via
  `NEXT_PUBLIC_DISABLE_SW=1` — WebKit + the SW + `page.route()` mocked
  POSTs interact badly. SW behavior is covered by unit tests instead.
  See [ADR 0010](./decisions/0010-disable-sw-in-playwright.md).

## Playwright configuration

- Two projects: `chromium-desktop` and `mobile-iphone` (WebKit).
- CI runs 4 workers (`ubuntu-latest` is a 4-core runner).
- CI uses the official `mcr.microsoft.com/playwright` container so we
  skip the `apt-get install-deps` step.
- Geolocation is granted up-front in the config so the AI feature's
  `getCurrentPosition()` resolves instantly across browsers instead of
  waiting the 6s in-app timeout.

See [ADR 0009](./decisions/0009-playwright-container-and-workers.md) for
the why on the CI Playwright setup.
