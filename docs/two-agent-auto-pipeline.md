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
                     ↻ commit + push           (verify runs against
                     ↻ commit + push           each push but doesn't
                     Update docs                 trigger the reviewer
                     ↻ commit + push           until the PR is marked
                     npm run verify             ready AND carries the
                     Finalize PR body            "claude-review" label.)
                     gh pr ready
                     gh pr edit --add-label
                       claude-review ──────────►
                                                 npm run verify (final)
                                                 (typecheck/lint/
                                                  vitest/playwright)
                                                       ▼
                                                 pass ──────────────────►
                                                                          (Has claude-review
                                                                          label? if not, skip.)
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

|                 |                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| **File**        | [`.github/workflows/claude-implementer.yml`](../.github/workflows/claude-implementer.yml)                      |
| **Trigger**     | `issues.labeled` where `label.name == 'claude'`                                                                |
| **Model**       | `claude-opus-4-8` (this is real implementation work)                                                           |
| **Auth**        | Official Claude GitHub App (required — see [Why an App token](#why-an-app-token-not-the-default-github_token)) |
| **Permissions** | `contents: write`, `issues: write`, `pull-requests: write`                                                     |
| **Max turns**   | 80                                                                                                             |
| **Output**      | Feature branch `claude/<issue-number>-<slug>`, draft PR with `Fixes #N`, transitioned to ready for review      |

The implementer inherits [`AGENTS.md`](../AGENTS.md) automatically
(the action reads it on startup). The workflow's inline `prompt:`
adds the step-by-step procedure: read the issue, plan, implement,
test, update docs per the convention, push, open a draft PR, then
mark ready.

### Reviewer

|                 |                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| **File**        | [`.github/workflows/claude-reviewer.yml`](../.github/workflows/claude-reviewer.yml)                                 |
| **Trigger**     | `workflow_run` after the `verify` workflow completes successfully                                                   |
| **Filter**      | Only runs for PRs (not pushes to `main`); skips draft PRs; **skips PRs that don't carry the `claude-review` label** |
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

## Why an App token, not the default `GITHUB_TOKEN`

GitHub's loop-prevention says: events triggered by the default
`GITHUB_TOKEN` do not trigger downstream workflow runs. If the
implementer used `GITHUB_TOKEN` to mark the PR as ready, the
`pull_request.ready_for_review` event would fire — but the
reviewer workflow would silently never start.

The fix is to use a GitHub App token instead. The official Claude
GitHub App is the easiest path: install it once, and the action
picks it up automatically. The reviewer's `workflow_run` trigger
then fires correctly when the verify workflow completes for the
implementer's commits.

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
token, which is what lets the implementer's PR + ready-for-review
events trigger the reviewer's `workflow_run` downstream. The
default `GITHUB_TOKEN` would silently fail to trigger anything.

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
- **`claude-review`** on a PR → makes the reviewer fire when verify
  goes green. Without it the reviewer skips, even if everything
  else is in place. The implementer adds this label to its own PRs
  as part of the auto-chain; humans add it manually when they want
  a review on their own PR.

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

| Guard                                            | What it stops                                             |
| ------------------------------------------------ | --------------------------------------------------------- |
| Branch protection requiring 1 human approval     | The agent merging its own (or another agent's) PR.        |
| Bot reviews don't satisfy the approval rule      | The reviewer agent self-approving to bypass the gate.     |
| `claude` label is the only implementer trigger   | Random comments / mentions don't spawn implementer runs.  |
| Reviewer triggers on `workflow_run` after verify | Reviewer doesn't run against broken implementations.      |
| Workflow runs in `permissions:` sandbox          | The agent can't change repo settings, secrets, or admin.  |
| Implementer pushes only to `claude/*` branches   | Naming convention makes bot-created branches obvious.     |
| App token (not default) for the implementer      | Loop-prevention doesn't kill the handoff to the reviewer. |
| Reviewer prompt explicitly forbids `--approve`   | Defense-in-depth alongside branch protection.             |

## What the pipeline does NOT do

- **Auto-address reviewer feedback.** Don't wire the reviewer's
  comments to re-trigger the implementer — that's the runaway-cost
  trap. Iterations go through a fresh human-driven trigger
  (re-label the issue, or `@claude address the review comments`
  manually).
- **Merge.** Branch protection prevents this and the prompts forbid
  it. Belt + suspenders.
- **Approve.** Same.
- **Respond to issue comments.** Only the label triggers the
  implementer. Adding context to an issue after the implementer has
  started has no effect on the in-flight run.
- **Run against `main` pushes.** The reviewer's `workflow_run`
  filter requires the upstream workflow to have been triggered by a
  pull request.

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

| Run                                   | Typical | Heavy  |
| ------------------------------------- | ------- | ------ |
| Implementer (Opus 4.8, ~80 turns)     | $2-8    | $8-20+ |
| Reviewer (Sonnet 4.6, ~15 turns)      | $0.20-1 | $1-3   |
| GitHub Actions runner minutes (Hobby) | free    | free   |

These are the **API-billing** figures (the fallback auth). Under the
current Max-subscription trial (see [Model auth: Max subscription
trial](#model-auth-max-subscription-trial)) the per-issue dollar cost
is $0 within quota — the real budget is the subscription's shared
5-hour + weekly usage limits, and the failure mode is a hard cutoff
mid-run rather than a bill.

To cap spend on the API-billing fallback, set [Anthropic API spend
limits](https://console.anthropic.com/settings/billing). The
implementer's `--max-turns 80` is also a hard ceiling either way.

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
  doesn't run them. The `workflow_run` gate ensures CI has gone
  green before the reviewer fires, but the reviewer's "is this
  test testing the right thing?" judgment is still pattern-matching.
- **Parallel issues with the `claude` label** spawn parallel
  implementers. They don't coordinate. Worst case: two PRs touching
  the same file conflict at merge time.
- **Force-pushes to a PR branch** re-trigger verify, which
  re-triggers the reviewer. Expect duplicate reviews on iterated
  PRs.

## References

- Implementer workflow: [`.github/workflows/claude-implementer.yml`](../.github/workflows/claude-implementer.yml)
- Reviewer workflow: [`.github/workflows/claude-reviewer.yml`](../.github/workflows/claude-reviewer.yml)
- Action source: <https://github.com/anthropics/claude-code-action>
- Action docs: <https://code.claude.com/docs/en/github-actions>
- Related: [`AGENTS.md`](../AGENTS.md) — the conventions both
  agents inherit.
- Related: [`docs/decisions/0001-everything-substantial-gets-a-doc.md`](./decisions/0001-everything-substantial-gets-a-doc.md) —
  the rule the agents enforce on themselves.
