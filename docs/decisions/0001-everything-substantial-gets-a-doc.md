---
status: accepted
date: 2026-05-23
---

# 0001 — Everything substantial gets a doc

## Context

This project is solo-developed, deployed to production, and used daily by the
author. It's also intended to read as a portfolio piece. Both of those uses
benefit from a written record of the engineering decisions and trade-offs
made along the way — but only if writing the record is a _default_, not a
heroic effort done in arrears.

A pattern from previous projects: documentation written months after the
fact is uniformly worse than documentation written when the work was fresh.
The author either forgets the alternatives that were considered, forgets why
some seemingly-arbitrary choice was actually constrained, or skips writing
it entirely.

## Decision

Anything beyond a minor bug fix lands with a docs update in the same PR.
This means one of:

- A new ADR in [`docs/decisions/`](./) when the change involves a material
  engineering judgement (architecture, dependency, format, security
  posture, performance budget).
- A new or updated feature doc in [`docs/features/`](../features/) when the
  change introduces or alters user-facing behavior.
- A new or updated runbook in [`docs/operations/`](../operations/) when the
  change adds new failure modes that someone (future-self included) will
  need to recover from.

"Minor bug fix" is the carve-out: tightening a regex, fixing a typo,
adjusting a CSS value. Anything that touches behavior, data shape,
infrastructure, dependencies, or test strategy is not a minor bug fix.

PR descriptions reference the doc that ships with the change.

## Alternatives considered

- **Document everything in commit messages.** Commit messages are good for
  the _what_ but bad for the _why_, especially the alternatives considered.
  They also can't easily be revised when the surrounding context changes.

- **Document only when asked / after the fact.** Tried this; doesn't work.
  The decisions either go unrecorded or get a sanitized retelling that
  loses the contemporary tradeoffs.

- **Long-form blog posts instead.** Higher friction; blog posts aren't
  versioned alongside the code that implements them. A blog can summarize
  multiple ADRs once the dust has settled.

## Consequences

- Each non-trivial PR is slightly bigger; the docs change has to be
  reviewed alongside the code change.
- New patterns and tools added later (Sentry, PostHog, etc.) all get an
  ADR before going in, so the "why this over that" is preserved.
- The portfolio-reader value compounds: a hiring manager arriving cold can
  read the decisions log and reconstruct the engineering reasoning without
  needing the author to narrate it.
- We will sometimes write an ADR for a decision that later turns out to
  have been over-engineered. That's fine — the ADR is then superseded with
  a new one explaining why we reverted, which is itself valuable.
