# Two-agent auto-pipeline

A pair of GitHub Actions workflows that turn the repo into a
loosely-supervised dev loop. You open an issue, label it `claude`,
and walk away. Claude implements it, runs tests, opens a PR, marks
it ready, then a second Claude reviews the PR and leaves comments.
You review the comments and merge (or not). Neither agent can merge.

```
   You                Implementer (Opus)         CI (verify)            Reviewer (Sonnet)            You
   ──                ───────────────────         ──────────             ──────────────────            ──
   Open issue
   Label "claude"
       ▼
                     Read issue
                     Investigate + plan
                     ┌──────────────────┐
                     │ Bootstrap draft  │  ←─ pushed within minutes of
                     │ PR (WIP body)    │      starting, so any later
                     └──────────────────┘      death leaves a recoverable
                     Implement + tests          partial branch.
                     ↻ commit + push
                     ↻ commit + push           (verify runs on every
                     ↻ commit + push           push; it gates the
                     Update docs                MERGE, not the review.)
                     ↻ commit + push
                     npm run verify
                     Finalize PR body
                     gh pr ready
                     gh pr edit --add-label
                       claude-review ──────────────────────────────────►
                                                                          (Non-draft + has
                                                                          claude-review
                                                                          label? else skip.)
                                                                          Read PR + diff
                                                                          Check seams,
                                                                          docs, ADRs
                                                                          gh pr review --comment
                                                                                  ─────────────►
                                                                                                  Read
                                                                                                  comments
                                                                                                  Address
                                                                                                  Merge
```

Branch protection on `main` enforces that the agents can't merge,
even if they ignore the prompt instructions.

## Why this exists

Most of the work on this repo follows a pattern: an issue describes
what needs to happen, the implementation is straightforward once
the relevant ADRs and feature docs are in mind, and the review is
a checklist (does the seam test exist? are docs updated? consistent
with prior decisions?). All three steps are well-suited to LLM
assistance.

This pipeline hands off small-to-medium issues end-to-end while
keeping the author as the only human who lands code. The agents do
the typing; the human does the judging.

## The agents

### Implementer

|                 |                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **File**        | [`.github/workflows/claude-implementer.yml`](../.github/workflows/claude-implementer.yml) (agent + prompt: [`.github/actions/claude-implement`](../.github/actions/claude-implement/action.yml)) |
| **Trigger**     | `issues.labeled` where `label.name == 'claude'`                                                                                                                                                  |
| **Model**       | `claude-opus-4-8` (this is real implementation work)                                                                                                                                             |
| **Auth**        | Official Claude GitHub App (required — see [Why an App token](#why-an-app-token-not-the-default-github_token))                                                                                   |
| **Permissions** | `contents: write`, `issues: write`, `pull-requests: write`                                                                                                                                       |
| **Max turns**   | 120                                                                                                                                                                                              |
| **Retries**     | Up to 2 **selective** retries (3 attempts) on transient flakes — see [ADR 0017](./decisions/0017-implementer-selective-retry.md)                                                                 |
| **Output**      | Feature branch `claude/<issue-number>-<slug>`, draft PR with `Fixes #N`, transitioned to ready for review                                                                                        |

The implementer inherits [`AGENTS.md`](../AGENTS.md) automatically
(the action reads it on startup). The step-by-step procedure (read the
issue, plan, implement, test, update docs, push, open a draft PR, mark
ready) lives in the **composite action**
[`.github/actions/claude-implement`](../.github/actions/claude-implement/action.yml)
— one source of truth shared by every retry attempt.

**Selective retries.** The agent occasionally dies on a transient Claude
Code harness bug (a `thinking`-block 400; also overloaded/5xx/429). The
workflow runs the composite up to **3 times**, but only retries when a
**triage** step ([`.github/actions/implementer-triage`](../.github/actions/implementer-triage/action.yml))
classifies the failure as transient — a turn-ceiling or any unrecognized
failure stops the chain immediately, and a partial branch/PR is cleaned
up before each retry. The job still red-X's if no attempt succeeds. The
job timeout is 90 min to span the chain. **Caveat:** a process _hang_
(an attempt that finishes but doesn't exit) is cancelled at the timeout,
not retried — see [ADR 0017](./decisions/0017-implementer-selective-retry.md).

### Reviewer

|                 |                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| **File**        | [`.github/workflows/claude-reviewer.yml`](../.github/workflows/claude-reviewer.yml)                                 |
| **Trigger**     | `pull_request` — `ready_for_review`, or `labeled` with `claude-review` (independent of CI status)                   |
| **Filter**      | Requires a **non-draft PR carrying the `claude-review` label**; skips drafts and unlabeled PRs                      |
| **Model**       | `claude-sonnet-4-6` (review is pattern-matching; fast + cheap is right)                                             |
| **Permissions** | `contents: read`, `pull-requests: write`, `issues: write`                                                           |
| **Max turns**   | 15                                                                                                                  |
| **Output**      | A single PR review submitted with `--comment` (never `--approve` or `--request-changes`), plus inline line comments |

The reviewer is told what to look for in priority order: the
seam-test convention from [ADR 0008](./decisions/0008-integration-tests-on-the-wiring-seam.md);
the docs convention from [ADR 0001](./decisions/0001-everything-substantial-gets-a-doc.md);
the `safeWrite` rule from [ADR 0012](./decisions/0012-localstorage-quota-handling.md);
the Suspense rule from [ADR 0006](./decisions/0006-suspense-for-search-params.md);
plus general bugs, accessibility regressions, and security.

### Reviser (`@claude` on a PR)

The lightweight iteration path. Mention **`@claude`** in a comment on a
PR — a top-level comment, an inline review comment, or a review summary
— and [`claude-pr-reviser.yml`](../.github/workflows/claude-pr-reviser.yml)
checks out that PR's branch and updates it: it reads the triggering
comment + **all** PR comments + inline review comments + the Claude
reviewer's notes, reads the linked issue (`Closes #N`) for the spec and
any refined decisions, plans the change, implements it on the branch
(commits only — never force-push), runs `verify:fast` (the reviser
runner has no Playwright browsers, so the full `verify` runs in CI on
the PR, not in-agent), and posts a summary comment. Same Opus 4.8 +
auth as the implementer.

**Loop guard:** it fires only on a **human** (`sender.type != 'Bot'`)
comment containing `@claude`, and the agent is told never to write
`@claude` in its own summary — so its own comments can't re-trigger it.
It's human-initiated by design (you decide when to mention it); it does
not auto-run on every comment.

## Why an App token, not the default `GITHUB_TOKEN`

GitHub's loop-prevention says: events triggered by the default
`GITHUB_TOKEN` do not trigger downstream workflow runs. If the
implementer used `GITHUB_TOKEN` to mark the PR as ready, the
`pull_request.ready_for_review` event would fire — but the
reviewer workflow would silently never start.

The fix is to use a GitHub App token instead. The official Claude
GitHub App is the easiest path: install it once, and the action
picks it up automatically. Because the implementer marks the PR
ready and adds the `claude-review` label using the App token, those
`pull_request` events trigger the reviewer's workflow downstream —
which the default `GITHUB_TOKEN` would not.

A custom app (via `actions/create-github-app-token`) works too;
use it if the official app is blocked by org policy.

## Model auth: Max subscription trial

The model auth is currently pointed at a **Claude Max subscription**
(OAuth token via `claude_code_oauth_token`) instead of pay-as-you-go
API billing. This is a trial to see whether subscription quota covers
the pipeline's real usage. Both workflows use it, so the whole
pipeline's usage bills against the one shared subscription.

What this changes:

- **Cost within quota is $0.** No per-issue API charge as long as you
  stay under the subscription's limits.
- **Caching gets better for free.** Prompt caching is automatic and on
  by default either way (there is no enable flag; only a
  `DISABLE_PROMPT_CACHING` escape hatch we don't set). Subscription
  auth requests the **1-hour** cache TTL at no extra cost; API-key auth
  defaults to 5 minutes. Within a single run this rarely matters — the
  cache is cold at the start of every fresh Actions run regardless, so
  the benefit is intra-run, not across runs.

What to watch:

- **Limits are shared and hard.** Max has a 5-hour rolling window _and_
  weekly caps, shared across Claude.ai, the desktop app, and every
  Claude Code session — including this pipeline. Hitting a cap is a
  hard cutoff, not a throttle: an in-flight implementer run can die
  mid-implementation. The save-your-work rule limits the blast radius
  (the partial branch survives) but the run won't finish. Opt-in usage
  credits keep things going past the cap, but at API rates — i.e. you'd
  be paying anyway.
- **It's a ToS gray area.** Subscription OAuth tokens are sanctioned
  for official Anthropic tools (Claude Code, which this action runs),
  but unattended CI use isn't explicitly documented. API-key billing is
  the unambiguous path; keep it as the fallback (step 2).
- **If we keep this past the trial, it earns an ADR** (cost/security
  posture) per [ADR 0001](./decisions/0001-everything-substantial-gets-a-doc.md).
  Right now it's an experiment.

A cheaper-reviewer alternative we verified but deferred (routing the
reviewer to DeepSeek) is captured in
[`deepseek-reviewer-option.md`](./deepseek-reviewer-option.md).

## Save-your-work: incremental commits, early draft PR

The implementer's prompt enforces a "save-your-work" rule: open the
draft PR right after planning, before writing any real code, then
commit + push after every meaningful unit of work. If the run dies
mid-implementation (turn ceiling, timeout, network blip, credit
limit, anything), whatever you've pushed survives on the branch and
the human can pick up from there.

The cost is more CI noise — every push triggers a verify run, so a
healthy implementer run might fire 5-10 verifies. That's free on
the Hobby tier and the trade for "never lose 30 minutes of work to
a runner restart" is worth it.

The draft PR's body starts as a one-line WIP placeholder and gets
swapped to the full summary/notes/test-evidence/docs template at
the end of the run, immediately before `gh pr ready`. The reviewer
agent only fires on the ready transition, so it doesn't see the WIP
body or the intermediate verify failures — it sees the final state.

When the implementer hits a wall, the prompt tells it to leave the
PR in draft, summarize what's done / what's not / what's blocking
in the PR body, and comment on the source issue with the same
summary. A partial PR is normal; treat it as a starting point, not
a complete change.

## Same-model blind spot

If you switched both agents to the same model, the reviewer would
share the implementer's reasoning blind spots and tend to bless
its choices rather than catch them. Splitting them across Opus
(implementer) and Sonnet (reviewer) reduces this somewhat. It
doesn't eliminate it.

**The auto review is a preliminary pass, not independent
verification.** Your final read is the real review. The reviewer's
job is to surface things you should look at, not to bless the PR.

## Setup checklist

These steps are one-time. The pipeline doesn't run until they're
all done.

### 1. Install the official Claude GitHub App

Visit <https://github.com/apps/claude>, click **Install**, pick this
repo (or grant org-wide access if you want the same pipeline on
other repos), and accept the permission scopes it requests.

The Claude Code action auto-detects the installed App and uses its
token, which is what lets the implementer's ready-for-review +
`claude-review` label events trigger the reviewer's `pull_request`
workflow downstream. The default `GITHUB_TOKEN` would silently fail
to trigger anything.

### 2. Set the model-auth secret

The pipeline currently authenticates the **model** against a Claude
Max subscription via an OAuth token — a trial (see
[Model auth: Max subscription trial](#model-auth-max-subscription-trial)).
Generate the token locally (it's interactive and needs a Claude
subscription) and store it as a secret:

```sh
claude setup-token                  # prints a long-lived OAuth token
gh secret set CLAUDE_CODE_OAUTH_TOKEN --body "<token from setup-token>"
```

Both workflows reference `secrets.CLAUDE_CODE_OAUTH_TOKEN`. To fall
back to pay-as-you-go API billing, swap each workflow's auth input
back to `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}` and set
that secret with `gh secret set ANTHROPIC_API_KEY`.

This token authenticates only the model. The GitHub App token that
does git/PR operations and fires the reviewer handoff is separate and
unchanged (step 1).

### 3. Create the labels

Two labels gate the pipeline — one per agent:

```sh
gh label create claude \
  --description "Hand this issue off to the Claude implementer agent" \
  --color "5319E7"

gh label create claude-review \
  --description "Request a Claude reviewer pass on this PR" \
  --color "0E8A16"
```

- **`claude`** on an issue → fires the implementer.
- **`claude-review`** on a non-draft PR → fires the reviewer (on the
  `ready_for_review` / `labeled` event). Without it the reviewer
  skips, even if everything else is in place. The implementer adds
  this label to its own PRs as part of the auto-chain; humans add it
  manually when they want a review on their own PR.

If you rename either, update the corresponding workflow's `if:`
filter / label-resolution step.

### 4. Branch protection on `main` (essential)

This is the load-bearing safety rule. Without it, a misbehaving
implementer could push directly to `main`, or the reviewer could
self-approve and merge.

```sh
gh api -X PUT "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/branches/main/protection" \
  --input - <<'EOF'
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "required_status_checks": {
    "strict": true,
    "contexts": ["typecheck + lint + vitest + playwright"]
  },
  "enforce_admins": false,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

Three pieces matter most:

- **`required_approving_review_count: 1`** combined with GitHub's
  rule that **a PR's author can't approve their own PR**. Both the
  implementer and the reviewer run under the same Claude GitHub
  App identity, so the App is the PR author — and even if the
  reviewer agent ignored its prompt and ran `gh pr review --approve`,
  GitHub silently rejects the approval as a self-review.
  Important: this safety hinges on _same identity_. If you ever
  split the agents across two App identities (e.g., a custom App
  for the reviewer), the reviewer's approval _would_ count, and
  the gate disappears. Re-think this before doing that.
- **`required_status_checks`** keeps a broken implementation from
  merging.
- **`enforce_admins: false`** lets you (the repo admin) bypass for
  emergencies. Flip to `true` if you want zero exceptions.

### 5. Smoke test

1. Open a tiny issue: _"Add a one-line greeting to the bottom of
   `docs/README.md`."_
2. Add the `claude` label.
3. Watch the Actions tab. A workflow run named **Claude Implementer**
   should appear within a minute.
4. Wait ~3-8 minutes for the implementer to push a branch, open a
   draft PR, run verify, and transition the PR to ready.
5. The `verify` workflow runs against the new PR. When it goes
   green, the **Claude Reviewer** workflow fires automatically.
6. Open the PR, read the agent's review, decide.

If any step doesn't fire, check the Actions tab for the workflow
run logs and the gotcha list below.

## What the agents are told (and not told)

Both agents inherit [`AGENTS.md`](../AGENTS.md) automatically. That
covers the Next-version warning and the docs convention from
[ADR 0001](./decisions/0001-everything-substantial-gets-a-doc.md).
Per-workflow `prompt:` adds the steps for the specific role.

For the implementer:

- Read the issue body. Treat it as the spec.
- Investigate the codebase: relevant feature docs, ADRs, existing
  patterns.
- Implement following the established conventions.
- Add or update tests at the right layer per
  [`docs/testing.md`](./testing.md), including the seam test from
  [ADR 0008](./decisions/0008-integration-tests-on-the-wiring-seam.md)
  when applicable.
- Update or add docs per the convention.
- Run `npm run verify`. It must pass before opening the PR.
- Push to `claude/<issue-number>-<slug>`.
- `gh pr create --draft --title <title> --body <body>` referencing
  `Closes #<n>` (matches the keyword the implementer workflow's
  prompt enforces).
- `gh pr ready <pr>` to transition out of draft.

For the reviewer:

- Read the PR description, the diff, and the issue it closes.
- Investigate the changes against the codebase — especially the
  ADRs the change touches.
- Look for specific failure modes (the order is the rubric, not
  exhaustive):
  1. New hook + caller without a seam integration test ([ADR 0008](./decisions/0008-integration-tests-on-the-wiring-seam.md))
  2. New behavior shipped without a docs update ([ADR 0001](./decisions/0001-everything-substantial-gets-a-doc.md))
  3. Material decision shipped without an ADR ([ADR 0001](./decisions/0001-everything-substantial-gets-a-doc.md))
  4. Direct `localStorage.setItem` instead of `safeWrite` ([ADR 0012](./decisions/0012-localstorage-quota-handling.md))
  5. `useSearchParams` consumer without a Suspense boundary ([ADR 0006](./decisions/0006-suspense-for-search-params.md))
  6. Extracted DOM methods like `const f = document.startViewTransition` (breaks `this` binding)
  7. ESLint rule disabled without a comment explaining why
  8. Test asserting only the happy path when edge cases are obvious
  9. Accessibility regressions (missing `aria-*`, focus traps, etc.)
  10. Security regressions (header changes, secrets in source, new env vars without Terraform)
- Leave inline comments + a single review-level comment summary.
- Always submit with `gh pr review --comment`. Never `--approve`,
  never `--request-changes`.

Both prompts live in the workflow YAML so they're versioned with
the rest of the repo. To change agent behavior, edit the workflow
and open a normal PR.

## Guard rails

| Guard                                                 | What it stops                                                |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Branch protection requiring 1 human approval          | The agent merging its own (or another agent's) PR.           |
| Bot reviews don't satisfy the approval rule           | The reviewer agent self-approving to bypass the gate.        |
| `claude` label is the only implementer trigger        | Random comments / mentions don't spawn implementer runs.     |
| Reviewer fires only on a non-draft `claude-review` PR | Routine PRs / other labels don't spawn (costly) review runs. |
| Workflow runs in `permissions:` sandbox               | The agent can't change repo settings, secrets, or admin.     |
| Implementer pushes only to `claude/*` branches        | Naming convention makes bot-created branches obvious.        |
| App token (not default) for the implementer           | Loop-prevention doesn't kill the handoff to the reviewer.    |
| Reviewer prompt explicitly forbids `--approve`        | Defense-in-depth alongside branch protection.                |

## What the pipeline does NOT do

- **_Auto_-address reviewer feedback.** The reviewer's comments don't
  re-trigger anything on their own — that's the runaway-cost trap.
  Iteration is **human-initiated**: mention `@claude` on the PR and the
  [Reviser](#reviser-claude-on-a-pr) updates it (or re-label the issue
  to re-run the implementer from scratch). The distinction is that a
  human decides when to iterate; nothing loops automatically.
- **Merge.** Branch protection prevents this and the prompts forbid
  it. Belt + suspenders.
- **Approve.** Same.
- **Respond to issue comments.** Only the label triggers the
  implementer. Adding context to an issue after the implementer has
  started has no effect on the in-flight run.
- **Run against `main` pushes.** The reviewer only triggers on
  pull-request `ready_for_review` / `labeled` events, so a direct
  push to `main` (which has no PR) never fires it.

## When NOT to use the pipeline

Use it for issues that the agent can plausibly land on its own.
Don't use it for:

- Changes that need architectural judgement (open an ADR yourself
  first; the agent implements against it after).
- Production incidents (you debug; the agent helps after).
- Anything touching secrets, IAM, or infrastructure provisioning
  (those go through Terraform, which Claude shouldn't `terraform
apply` autonomously).
- Tasks where the issue body would have to be longer than the
  resulting code change.

For everything else: open the issue, write what you'd write for a
human contributor, label it `claude`, watch the loop run.

## Cost considerations

Rough per-issue cost, depending on complexity:

| Run                                   | Typical | Heavy   |
| ------------------------------------- | ------- | ------- |
| Implementer (Opus 4.8, ~120 turns)    | $3-10   | $10-24+ |
| Reviewer (Sonnet 4.6, ~15 turns)      | $0.20-1 | $1-3    |
| GitHub Actions runner minutes (Hobby) | free    | free    |

These are the **API-billing** figures (the fallback auth). Under the
current Max-subscription trial (see [Model auth: Max subscription
trial](#model-auth-max-subscription-trial)) the per-issue dollar cost
is $0 within quota — the real budget is the subscription's shared
5-hour + weekly usage limits, and the failure mode is a hard cutoff
mid-run rather than a bill.

To cap spend on the API-billing fallback, set [Anthropic API spend
limits](https://console.anthropic.com/settings/billing). The
implementer's `--max-turns 120` is also a hard ceiling either way.
(Raised from 80 after a run did all the work but ran out of turns on
the finalization step; 120 leaves headroom to mark the PR ready.)

### Friction the prompt pre-empts

A post-mortem on the first successful run ($5.51, 102 turns) found
~34% of the cost was friction rather than implementation. The
prompt now pre-empts the common time-wasters:

- **Environment facts** ("Husky is disabled, no sudo, npm deps
  installed, Playwright deps missing, App token can't write
  workflows") so the agent doesn't have to discover them by trying
  and failing.
- **Repo layout** so the agent doesn't `ls` directories that have
  predictable contents.
- **`npm run verify:fast`** (`verify:static` + unit tests, ~10s)
  for iteration. Full `npm run verify` (~5min including E2E) is
  reserved for one final check before marking ready. Previous runs
  ran full verify 2-3 times mid-implementation; the prompt now
  forbids that.
- **"Don't re-read the issue"** rule. The agent was reading the
  issue body in 3 different formats hoping for clarity.

Expected savings: ~$1-2 per medium-sized issue.

## Tool allowlist (don't forget this one)

The `claude-code-action` ships with a restrictive default tool
allowlist that **excludes `Bash`**. Without explicitly opting Bash
back in via `--allowed-tools`, every `git`, `gh`, and `npm` call
the agent attempts gets blocked and the run produces nothing
visible (no commits, no PR, no comment) while still consuming
turns and spend.

Both workflows pass `--allowed-tools` in `claude_args`:

- **Implementer:** `Bash,Edit,Read,Write,Glob,Grep,WebFetch,WebSearch`
- **Reviewer:** `Bash,Read,Glob,Grep,WebFetch` (no `Edit` or
  `Write` — the reviewer is read-only on the codebase)

If you ever see a run finish with `permission_denials_count > 0`
in the result JSON, that's the signal something the agent tried
hit the default-deny. Fix is to extend the allowlist for that
workflow.

## Limitations + known issues

- **Agents only see the repo.** Issues referencing private docs,
  design files, Slack threads, etc. produce work that misses that
  context. Inline the relevant context in the issue body.
- **Long runs may exceed the turn budget.** If hit, the implementer
  leaves the branch + PR in a partial state and the next iteration
  is on the human (or a fresh re-trigger).
- **The reviewer can't execute tests.** It reads test files but
  doesn't run them. It also no longer waits for CI — it fires on the
  ready/label event, so it may review a diff before `verify` is
  green. That's intentional: branch protection's required status
  checks still block merging non-green code, so the review is purely
  advisory and its "is this test testing the right thing?" judgment
  is pattern-matching either way.
- **Parallel issues with the `claude` label** spawn parallel
  implementers. They don't coordinate. Worst case: two PRs touching
  the same file conflict at merge time.
- **Pushing new commits to a PR does not re-trigger the reviewer.**
  It fires on `ready_for_review` / `labeled`, not on pushes. To get a
  fresh review after changes, remove and re-add the `claude-review`
  label (or toggle the PR back to draft and mark it ready again).
- **Reviewer-workflow changes only apply to PRs branched afterward.**
  `pull_request` workflows run from the **PR's head branch**, not
  `main`. So edits to `claude-reviewer.yml` take effect only for PRs
  whose branch was cut from a `main` that already had them; PRs already
  in flight keep the old reviewer behaviour until rebranched. (The
  implementer always branches from current `main`, so new runs are
  fine — this only bites while iterating on the reviewer workflow
  itself.) The old `workflow_run` trigger didn't have this property
  because it always ran from the default branch.
- **The reviewer runs under a bot actor.** Its trigger is the
  implementer (`claude[bot]`) adding the label, so the action's
  bot-actor guard requires `allowed_bots` to list our App. It's scoped
  to `claude[bot]` only — never `*` on this public repo.

## References

- Implementer workflow: [`.github/workflows/claude-implementer.yml`](../.github/workflows/claude-implementer.yml)
- Reviewer workflow: [`.github/workflows/claude-reviewer.yml`](../.github/workflows/claude-reviewer.yml)
- Action source: <https://github.com/anthropics/claude-code-action>
- Action docs: <https://code.claude.com/docs/en/github-actions>
- Related: [`AGENTS.md`](../AGENTS.md) — the conventions both
  agents inherit.
- Related: [`docs/decisions/0001-everything-substantial-gets-a-doc.md`](./decisions/0001-everything-substantial-gets-a-doc.md) —
  the rule the agents enforce on themselves.
