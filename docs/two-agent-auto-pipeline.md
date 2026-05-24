# Two-Agent Claude Code Pipeline — Design Notes

## Goal

Build a GitHub automation pipeline using `anthropics/claude-code-action@v1`:

1. I create an issue and mark it for Claude. An **implementer agent** picks it up,
   investigates, implements, tests, and opens a PR with a thorough description of
   its reasoning and how it tested.
2. The implementer marks the PR ready for review itself, which automatically
   triggers a **reviewer agent** that leaves a preliminary review (inline
   comments/suggestions) and verifies docs match the changes.
3. I come in last — after both agents have run — to a PR that's already
   implemented and pre-reviewed. I approve and merge.
4. Neither agent can merge. Merging requires my explicit human approval.

Runs on GitHub-hosted runners (works with my machine off).

## Flow (auto-chain)

issue (labeled) -> Implementer agent -> opens PR + marks ready
-> (CI runs) -> Reviewer agent (preliminary review + doc check)
-> [I review the implemented, pre-reviewed PR] -> I approve + merge

No manual step between the two agents. The human gate is at the END (approval +
merge), not in the middle.

## Workflow A — Implementer (.github/workflows/claude-implement.yml)

- Trigger: `issues: [labeled]` filtering for a `claude` label (preferred), OR
  `issues: [assigned]` with `assignee_trigger` set to a designated login.
- Permissions: contents: write, pull-requests: write, issues: write.
- Auth: MUST use a GitHub App token (see gotchas) — required for the handoff to fire.
- Steps: checkout -> generate App token -> run action.
- Prompt: read issue #N, investigate, implement, run tests, open a PR with
  `Fixes #N`, write a description covering reasoning + test evidence, then mark it
  ready for review (open non-draft, or open draft then `gh pr ready`).
- claude_args: `--model claude-opus-4-7 --max-turns 30` (tune turns).

## Workflow B — Reviewer (.github/workflows/claude-review.yml)

- Trigger: `pull_request: [opened, ready_for_review]`.
  Refinement: trigger on `workflow_run` after CI completes instead, so the reviewer
  evaluates against green tests rather than racing them.
- Permissions: contents: read (or write if it should commit doc fixes — see open
  decisions), pull-requests: write.
- Steps: checkout -> run action.
- Prompt: review the diff against a specific failure-mode checklist (NOT a vague
  "review this PR"), leave inline comments/suggestions, verify docs reflect the
  changes. Submit review as COMMENT, NEVER APPROVE.
- claude_args: `--model claude-opus-4-7`.

## Merge protection (enforced independently of the agents)

Branch protection / ruleset on `main`:

- Require a PR before merging.
- Require at least 1 approving review.
- Reviewer agent only comments (never APPROVE), so the only thing that can satisfy
  the approval gate is me. -> Neither agent can merge, by construction. Unaffected
  by the auto-chain.
- Disable auto-merge; optionally require my approval via CODEOWNERS.

## Resolved facts / gotchas

- App token is REQUIRED, not optional. The implementer triggers the reviewer, and
  the default `github-actions` token cannot trigger downstream workflows (GitHub
  loop-prevention). Use the official Claude app (/install-github-app) or your own
  app via create-github-app-token. Without it, the reviewer silently never runs.
- Event detail: opening a PR emits `opened`, not `ready_for_review`. So either open
  non-draft (trigger reviewer on `opened`), or open draft then `gh pr ready` to emit
  the conversion. Triggering on `[opened, ready_for_review]` covers either path.
- "Assign to Claude" is NOT a native assignable bot like Copilot. The action
  triggers via workflow config (`assignee_trigger` or a label), not bot assignment.
  A `claude` label is cleaner and more robust.
- Only users with WRITE access can trigger the action. Org settings can block app
  installs — check if this lands in a work org repo.
- Same-model blind spot: both agents are Opus 4.7, so the reviewer shares the
  implementer's reasoning blind spots and may bless its choices rather than catch
  them. The auto "preliminary review" is NOT independent verification — my final
  pass is the real review. Mitigate with a sharp, opinionated reviewer rubric
  (specific failure modes to hunt for).
- Cost note: the reviewer runs on every PR including bad implementations (no cheap
  human kill-switch before the review pass, unlike a draft-gated flow). Cap with
  `--max-turns`.
- "Test it thoroughly" requires CI that can actually run the tests. Unit tests run
  fine on the runner; integration tests need Kafka + DynamoDB via `services:`
  containers (Kafka image, DynamoDB Local / LocalStack) wired into Workflow A, else
  testing degrades to unit-only.
- Default model is Sonnet; use `--model claude-opus-4-7` for both agents.

## Rollout (recommended)

- Phase 1 (pipeline unproven): keep a manual draft gate — implementer opens DRAFT
  and stops; I flip to ready-for-review after eyeballing it. Catches bad
  implementations before paying for a review pass.
- Phase 2 (implementer trusted): drop the draft step / add `gh pr ready` so it
  auto-chains. One-line change. Keep the draft-gate version commented out as a toggle.

## Open decisions

1. Reviewer + docs: FLAG stale docs as review comments (read-only, recommended
   default), or FIX by committing doc-only changes to the PR branch (contents:
   write, scoped to docs/comments only)?
2. Testing depth at launch: unit-only to start (no service containers), or
   integration from day one (add Kafka/Dynamo service-container matrix to Workflow A)?

## Deliverables still to write

- claude-implement.yml and claude-review.yml (full, auto-chain with draft-gate toggle).
- Branch-protection ruleset.
- CLAUDE.md implementation + reviewer rubric tuned to NestJS + Kafka + DynamoDB
  (span-hierarchy conventions, DynamoDB access patterns, reviewer failure-mode list).

## Don'ts

- Do NOT auto-trigger the implementer from the reviewer's comments to "address
  feedback." That's the loop/runaway-cost trap. Keep revisions a manual
  `@claude address the review comments` mention until the pipeline is proven.
