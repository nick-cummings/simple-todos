---
status: accepted
date: 2026-05-30
---

# 0017 — Implementer: selective retries via a composite action

## Context

The implementer agent intermittently dies on a **Claude Code harness bug**:

```
API Error: 400 … `thinking` or `redacted_thinking` blocks in the latest
assistant message cannot be modified.
```

It's transient (compaction / transcript round-trip corrupts the signed thinking
blocks mid-run), **independent per run**, and **quota-independent** — confirmed
`rate_limit_info: allowed` throughout, even at 12× concurrency. Observed rate is
~1-in-4. At single-issue scale that was a shrug; when we labelled 12 mockup
issues at once, 3 failed on it (and one more on a separate process-hang). Hand
re-triggering each — close partial PR, delete branch, re-label — is real toil,
and a single re-trigger is just another 25% coin flip (#68 flaked twice in a
row that way).

Constraints:

- GitHub Actions has **no native retry for a `uses:` action step** (`retry`
  keywords / `nick-fields/retry` wrap `run:` shells only). The implementer _is_
  a `uses: anthropics/claude-code-action@v1` step.
- A failed attempt sometimes leaves a partial `claude/<issue>-*` branch + draft
  PR (occasionally with a garbled slug), which would collide with the next
  attempt's `git checkout -b`.
- The huge procedure prompt must not be duplicated per attempt.

## Decision

Retry the implementer **up to twice (3 attempts total)**, **selectively** — only
on known-transient flakes — built from two composite actions:

- **`.github/actions/claude-implement`** — the agent: model/tool config +
  the full procedure prompt, parameterised by `issue` + `oauth_token`. Single
  source of truth, invoked by every attempt (keeps it DRY; no loops exist for
  `uses:` steps, so the 3 invocations are literal but thin).
- **`.github/actions/implementer-triage`** — between attempts: reads the
  action's `claude-execution-output.json`, sets `retry=true` **only** when the
  failure matches a transient signature, and (when retrying) closes any partial
  PR + deletes any `claude/<issue>-*` branch first.

The workflow chains: `attempt (continue-on-error) → triage → attempt → triage →
attempt`, then a final gate that **fails the job iff no attempt succeeded** (so
exhausted / non-retryable failures still red-X).

**Retryable** (fresh run clears it): the thinking-block 400, `overloaded_error`,
HTTP 5xx/429/529, connection/fetch errors. **Not retryable** (a retry only burns
another run): `Reached maximum number of turns`, anything unrecognised, or a
missing output file.

## Consequences

- **Most runs are unaffected** — a first-attempt success skips straight to the
  gate. Only the ~25% that flake pay for a retry.
- **Flakes self-heal**: failure odds drop ~25% → ~6% (1 retry) → ~1.5% (2).
- **Cost**: ~+25% Opus burn _on the failing fraction only_ — modest, all on the
  Max subscription (which absorbs the concurrency).
- **Job `timeout-minutes` 40 → 90** to span up to three attempts; each attempt
  is still bounded by `--max-turns 120`.
- **DRY**: the prompt lives once; tuning the agent is a one-file change.

### Limitations

- **Process _hangs_ are not retried.** If an attempt finishes its work but the
  action process doesn't exit (the leftover-E2E-test-server case — see #65), the
  job is _cancelled_ at the timeout, not _failed_, so triage never runs. The
  real fix for that is separate: stop the implementer running full E2E
  in-action (it's redundant with CI's `verify`) so no server is left to leak —
  tracked independently. Selective retry only covers reported failures.
- Triage classifies from a string-match on the result file; a brand-new
  transient signature would fall through as non-retryable until added.

## Alternatives considered

- **Blanket retry (any failure).** Simpler, but wastes a full Opus run on
  deterministic failures (turn ceiling, real bugs). Selective avoids that.
- **`gh run rerun --failed` from an `on: workflow_run` watcher.** Re-runs the
  whole job from a separate workflow — more decoupled, same branch-collision
  problem, and no clean hook to classify/clean between attempts. The in-job
  chain is self-contained.
- **Disable extended thinking (`MAX_THINKING_TOKENS=0`).** Eliminates the bug
  class outright but at a real implementation-quality cost; not worth it for a
  ~25% intermittent flake.
- **Per-step `timeout-minutes` to convert hangs into retryable failures.**
  Rejected: a hang-after-success (#65) would wrongly retry already-complete
  work. Better to fix the hang's root cause separately.
