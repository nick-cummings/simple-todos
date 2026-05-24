---
status: accepted
date: 2026-05-24
---

# 0013 — Pre-push runs tests only when code changes

## Context

The `pre-push` hook (`.husky/pre-push`) ran the full `verify` pipeline
unconditionally: `format:check`, `typecheck`, `lint`, `vitest`, and
`playwright`. On this repo the test suites dominate that wall time —
the unit run plus the Playwright run together are ~4-5 minutes, while
the three static checks finish in seconds.

A large share of pushes touch no code: an ADR, a feature doc, a README
tweak, a workflow YAML edit. None of those can change a vitest or
Playwright outcome — the test files don't import markdown, and the test
runners don't execute workflow YAML. Paying four-plus minutes to prove
that a docs edit didn't break the suite is pure friction, and friction
on the hook is what tempts people into `--no-verify`, which then skips
the checks that _do_ matter.

## Decision

Split the pipeline and gate the slow half on what changed:

- `verify:static` = `format:check && typecheck && lint` (the fast checks).
- `verify` = `verify:static && test:run && test:e2e` (unchanged behavior).

The `pre-push` hook reads the pushed commits from stdin (the standard
pre-push contract), takes the union of files they touch, and classifies
the push:

- If **every** changed file is in a docs/CI/meta allowlist — `*.md`,
  `docs/**`, `LICENSE*`, `.github/**`, and a few dotfiles
  (`.gitignore`, `.prettierignore`, `.gitattributes`, `.editorconfig`)
  — it runs `verify:static` only.
- Otherwise (any `src/**`, config, `package.json`, lockfile, hook, etc.)
  it runs the full `verify` with tests.

Note `verify:static` still runs Prettier across the whole tree, so a
docs-only push is _not_ unchecked — markdown formatting and YAML
formatting are still enforced; only the test suites are skipped.

**CI is unchanged and remains the source of truth.** The `verify`
GitHub Actions workflow runs the full suite on every PR regardless of
what changed. The hook is a local-time convenience; it is intentionally
allowed to be more permissive than CI because CI is the gate that
actually protects `main`.

The classification fails safe: an unrecognized path runs the tests, and
the new-branch code path (which can't diff against a remote-tracking
ref) errs toward including commits, i.e. toward running tests.

## Alternatives considered

- **Leave it unconditional.** Simplest, but the recurring 4-5 min tax on
  docs pushes is the exact thing that trains people to reach for
  `--no-verify`. Reducing the cost of the honest path is the point.
- **Move the whole gate to a pre-commit hook with `lint-staged`.**
  Per-file staged-only checks are great for formatting but a poor fit
  for a test suite, which is inherently cross-file — a staged change to
  one module can break a test in another. Pre-push against the full
  commit range is the right granularity for tests.
- **Drop the local hook entirely and rely on CI.** Tightens the loop
  for whoever forgets — you'd only learn a test broke after pushing and
  waiting on Actions. The fast local feedback on code changes is worth
  keeping.
- **Path-filter inside CI instead of locally.** Orthogonal, and riskier:
  skipping CI test jobs based on changed paths can let a required check
  go "green" without running, which interacts badly with branch
  protection's required-status-checks. Keep CI exhaustive; optimize only
  the local hook.

## Consequences

- **Docs/CI-only pushes finish in seconds.** The common
  documentation-with-the-change workflow (ADR 0001) stops being taxed by
  the test suite.
- **The allowlist is a maintenance point.** A new top-level category of
  non-code file (say, a `design/` directory of images) won't be
  recognized and will trigger the full suite until added. That's the
  safe failure, but it's a thing to remember.
- **The hook is shell, not unit-tested.** The file-classification logic
  was validated by hand against representative path sets. Changes to the
  `case` allowlist should be re-checked the same way.
- **Local and CI can now disagree on what ran.** A docs push that passes
  locally still gets the full suite in CI. That's intended — but it
  means "it passed pre-push" is a weaker statement than before for
  docs-adjacent changes. CI remains the real signal.

## References

- Code: `.husky/pre-push`, `package.json` (`verify:static`, `verify`)
- CI: `.github/workflows/verify.yml` (always runs the full suite)
- Related: [ADR 0001](./0001-everything-substantial-gets-a-doc.md)
  (docs ship with the change — this lowers the cost of doing so),
  [ADR 0007](./0007-strict-eslint-tier-3.md),
  [ADR 0009](./0009-playwright-container-and-workers.md)
- External: Git `githooks(5)` — the pre-push stdin contract
