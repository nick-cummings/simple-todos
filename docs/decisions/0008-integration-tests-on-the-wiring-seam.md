---
status: accepted
date: 2026-05-21
---

# 0008 — When a feature splits into "hook + caller", test the seam

## Context

The reminders rollout shipped with seemingly comprehensive test
coverage:

- Unit tests for `useReminders` (the hook): subscription flow,
  fireAt computation, syncTodoReminder POST/DELETE, etc.
- Unit tests for `TodoApp` (the caller): renders, opens modal,
  filters, etc.

Despite that, two production bugs went out:

1. The reminders hook captured a stale `todos` closure in a
   `queueMicrotask`. Newly-added todos never registered for reminders.
2. There was no initial sync when reminders activated for existing
   todos — only newly-mutated ones got synced.

Both bugs lived in the _wiring_ between `TodoApp` and `useReminders`.
Each side's unit tests passed because each side was correct in
isolation. The mistake was in the calling pattern.

The user's reaction (paraphrased): _"Why didn't we have tests in
place to catch these? We literally just expanded coverage."_

## Decision

When a feature splits into "hook does the work + component wires it
up", an integration test on the seam is required. The test:

- Mocks the dependency hook (`vi.mock("@/lib/useReminders")`).
- Renders the component.
- Asserts the _call pattern_ — `expect(syncTodoReminder).toHaveBeenCalledWith(...)`.

This catches bugs unit tests can't: wrong arguments, missed calls,
stale closures, race conditions in effect setup.

Unit tests on each side remain useful — they're cheap and they pin
down the contract. But they are not a substitute for the seam test.

## Alternatives considered

- **More E2E tests.** Slower feedback loop, harder to assert on
  specific call patterns, and requires real Web Push / Notification
  infra which we don't want to instantiate in tests.
- **Property-based testing.** Overkill for the seam class of bugs
  here; the failures were always about a specific call shape, not
  about input distributions.
- **Just be more careful.** Hope is not a strategy.

## Consequences

- **Every "hook + caller" feature ships with a seam integration
  test.** This convention is enforced by code review (= self-review),
  not by automation.
- **Tests can be brittle to refactors.** If the wiring shape changes
  (e.g., we add a debounce wrapper), the seam test needs to update.
  That's the right tradeoff — the test is asserting the call pattern,
  which is exactly what we want to track.
- **Test setup is more involved.** Mocking hooks (especially ones that
  rely on `useSyncExternalStore` or other React internals) is fiddly.
  We have a few patterns now (see `TodoApp.test.tsx`) that can be
  copy-pasted for new seams.

## References

- The fix: `src/components/TodoApp/index.tsx` reconciliation effect,
  replacing the per-mutation `queueMicrotask`.
- Seam tests: `src/components/TodoApp.test.tsx` — `describe("<TodoApp>
— reminders seam", ...)`.
- Related memory: `feedback_integration_test_seams.md` in the
  contributor's auto-memory.
