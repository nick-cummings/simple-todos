---
status: accepted
date: 2026-05-18
---

# 0007 — Strict ESLint (tier 3) over a permissive setup

## Context

The default ESLint configuration that ships with `create-next-app` is
intentionally permissive — it flags a few obvious bugs but lets a lot
through. For a solo project intended as portfolio code, the bar should
be higher: catch dumb mistakes at lint time so PR review (and the
author's future-self) doesn't have to.

The ESLint ecosystem has tiers of strictness. Roughly:

- **Tier 1**: `eslint-config-next` defaults. Catches obvious bugs.
- **Tier 2**: + `typescript-eslint` recommended. Catches more type-aware
  bugs.
- **Tier 3**: + `typescript-eslint` `strict-type-checked` and
  `stylistic-type-checked`, plus quality plugins (`unicorn`,
  `perfectionist`, `security`, `sonarjs`).

## Decision

Adopt tier 3 with selective rule overrides for the cases where the
rule is too noisy to be useful.

The overrides live in `eslint.config.mjs` with comments explaining
each one. Examples:

- `unicorn/no-typeof-undefined` off, because
  `typeof window === "undefined"` is the universal SSR guard and
  rewriting it to `window === undefined` throws at runtime in Node.
- `security/detect-object-injection` off, because it flags every
  computed property access and has no real signal here.
- `unicorn/filename-case` off, because React conventionally uses
  PascalCase for component files.
- Per-file relaxations for tests, config files, and the service
  worker.

Type-checked rules are disabled for plain `.js` / `.mjs` files (no
`tsconfig` covers them, so type-aware lint blows up).

## Alternatives considered

- **Tier 2 only.** Easier path. Catches less; specifically misses
  several real bug categories like accidental `Promise` misuse
  (`@typescript-eslint/no-misused-promises`), unsafe `any`
  propagation, and unintentional shadowing.
- **Tier 3 with no overrides.** Tried briefly; some rules are net-
  negative for this codebase (the `no-typeof-undefined` one would
  break SSR). The overrides are minimal and each is justified.
- **Biome / Oxlint.** Faster, but the rule coverage isn't there yet
  for type-aware lint. Revisit in a year.

## Consequences

- **Lint pass takes ~20s in CI** — meaningfully slower than tier 1.
  Acceptable for the bugs it catches.
- **New code occasionally surfaces a rule the author hasn't seen
  before.** Each one is either fixed in place or added to overrides
  with a comment. Overrides are the exception, not the rule.
- **`tier 3` strict-type-checked enforces type-aware rules.** This
  means lint is downstream of typecheck; if `tsc --noEmit` fails,
  lint will also fail. We run typecheck first in `verify` so the
  message order makes sense.
- **`max-lines: 500` is enforced**, with overrides for test files
  (which sprawl across many cases). Forces feature components to
  decompose at a reasonable boundary.

## References

- Configuration: `eslint.config.mjs`
- `verify` script: `package.json`
- Plugins: `eslint-plugin-unicorn`, `eslint-plugin-perfectionist`,
  `eslint-plugin-security`, `eslint-plugin-sonarjs`
