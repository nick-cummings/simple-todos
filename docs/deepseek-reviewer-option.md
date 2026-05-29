# DeepSeek as a reviewer-model option (deferred)

A reference note, not a decision. It captures what we verified about
routing the **reviewer** agent to DeepSeek instead of a Claude model,
so a future evaluation doesn't start from scratch. We are **not**
adopting this now — the reviewer stays on Claude (Sonnet 4.6). See
[`two-agent-auto-pipeline.md`](./two-agent-auto-pipeline.md) for the
live pipeline.

## Why it came up

Review is mostly reading and pattern-matching against a rubric, not
novel implementation — the part of the pipeline where frontier
capability matters least. A much cheaper model could plausibly do it,
which is where DeepSeek entered the conversation.

## What's verified (as of May 2026)

- **Drop-in compatible.** DeepSeek exposes an Anthropic Messages API
  endpoint at `https://api.deepseek.com/anthropic`, usable by Claude
  Code via `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` — no proxy.
  Its built-in model mapping sends `claude-sonnet*` / `claude-haiku*`
  to `deepseek-v4-flash` and `claude-opus*` to `deepseek-v4-pro`.
- **Cheap.** `deepseek-v4-flash`: ~$0.14/M input (cache-miss),
  ~$0.28/M output, ~$0.0028/M cache-hit input — pennies per review.
- **Caching still applies** the same way it does on Claude (automatic,
  on by default).

## Why we're deferring

- **Data egress is the blocker.** DeepSeek's published privacy policy:
  data is stored in **China**, used to **train models by default**
  (an opt-out exists but it's unclear it cleanly covers the API tier),
  and retained indefinitely. Routing reviews there ships the full PR
  diff plus `CLAUDE.md`/`AGENTS.md` to that posture. Low stakes for a
  hobby PWA, but it's a conscious privacy decision, not a config flip.
- **The safety gate is unaffected (good).** The reviewer only ever
  comments, never approves, so moving it off the Claude API does not
  touch the self-approval branch-protection gate — no new hole.
- **Blind-spot diversity is a bonus.** A non-Claude reviewer would
  _reduce_ the same-model blind spot the pipeline doc warns about — a
  point in its favor whenever we revisit.

## What adoption would require

1. An **ADR** for the third-party data-egress decision (per
   [ADR 0001](./decisions/0001-everything-substantial-gets-a-doc.md)).
2. A DeepSeek API key stored as a secret, and the reviewer workflow's
   auth + `ANTHROPIC_BASE_URL` / model env wired up.
3. A side-by-side quality check: run DeepSeek and Sonnet on the same
   handful of real PRs and confirm it still catches the rubric items
   (especially security and accessibility) before trusting it.

## Pricing caveat

`deepseek-v4-pro` pricing was mid-promotion at the time of writing and
changes after 2026-05-31; re-check before quoting. The flash-tier
numbers above were current. The legacy `deepseek-chat` /
`deepseek-reasoner` aliases retire 2026-07-24 in favour of the
`deepseek-v4-*` names.

## Sources

Verified May 2026 against DeepSeek's API docs (`api-docs.deepseek.com`)
and privacy policy, as part of the Phase 0 research behind the
Opus 4.8 / Max-subscription pipeline changes.
