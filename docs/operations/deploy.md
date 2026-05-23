# Deploy runbook

## Flow

```
local change → git push origin main → GitHub Actions verify → Vercel auto-deploy
                                              │
                                              ↓ (on red)
                                          fix or revert
```

GitHub Actions (`.github/workflows/verify.yml`) runs `npm run verify` on
every push to `main` and on every PR. Vercel auto-deploys `main`
regardless of CI state, so a red CI doesn't actually block production —
**revert quickly if a bad merge lands.** Vercel's deploy preview can be
inspected from the dashboard.

## Required environment variables

Set in Vercel via Terraform (`infra/main.tf` → `vercel_project_environment_variable`
resources). The local source of truth is `infra/terraform.tfvars`
(gitignored).

| Variable                       | Where used                  | Notes                                           |
| ------------------------------ | --------------------------- | ----------------------------------------------- |
| `ANTHROPIC_API_KEY`            | `/api/generate-description` | Server-only.                                    |
| `UPSTASH_REDIS_REST_URL`       | `src/lib/pushStore.ts`      | Server-only.                                    |
| `UPSTASH_REDIS_REST_TOKEN`     | `src/lib/pushStore.ts`      | Server-only.                                    |
| `VAPID_PUBLIC_KEY`             | build-time → client         | Public key half.                                |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | build-time → client         | Mirror of above with the `NEXT_PUBLIC_` prefix. |
| `VAPID_PRIVATE_KEY`            | `src/lib/webPush.ts`        | Server-only.                                    |
| `VAPID_SUBJECT`                | `src/lib/webPush.ts`        | `mailto:` for Web Push.                         |
| `CRON_SECRET`                  | `/api/push/notify-cron`     | Vercel Cron auto-attaches as bearer.            |

## Applying infrastructure changes

```sh
cd infra
terraform plan      # review
terraform apply
```

Terraform owns: env vars on the Vercel project, the cron schedule
(via `vercel.json`, which is committed). Anything else (project
settings, domains) is managed in the Vercel UI for now — those decisions
are listed in [ADR 0003](../decisions/0003-vercel-hobby-constraints.md).

## Rollback

Two paths, in increasing severity:

1. **Revert the bad commit on `main`.** Vercel auto-deploys the revert.
   Preferred for code regressions.
2. **Promote an older Vercel deployment.** From the Vercel dashboard,
   open the deployments list, pick a known-good one, and click
   _Promote to Production_. Use when the revert itself would be risky
   (e.g., a database migration or infra change) or when you need to
   roll back immediately and the revert PR isn't ready.

For Terraform-managed changes, `terraform apply` the prior state from
`infra/terraform.tfstate.backup` if needed — but think twice; the state
file is checked in and `terraform plan` may show drift.

## Cron schedule

`vercel.json` declares a single cron:

```json
{ "path": "/api/push/notify-cron", "schedule": "0 15 * * *" }
```

Daily at 15:00 UTC. Hobby tier supports daily-only schedules; that's
the entire reason for this cadence.
See [ADR 0004](../decisions/0004-web-push-via-vapid.md).

To change the schedule, edit `vercel.json` and push. Vercel reconciles
the cron config on every deploy.

## Manual verification after deploy

1. Open the PWA on the iPhone (or the deployed URL in Safari).
2. Add a todo with today's due date.
3. Confirm the reminder gate is visible.
4. Optionally: trigger the cron manually via
   `curl -H "Authorization: Bearer $CRON_SECRET" https://<your-url>/api/push/notify-cron`
   and confirm a notification fires.

## Where things live

| Concern                   | Path                           |
| ------------------------- | ------------------------------ |
| Build/runtime config      | `next.config.ts`               |
| Cron schedule + headers   | `vercel.json`                  |
| PWA manifest              | `public/manifest.webmanifest`  |
| Service worker            | `public/sw.js`                 |
| Infra (env vars, project) | `infra/*.tf`                   |
| CI                        | `.github/workflows/verify.yml` |
| Pre-push gate             | `.husky/pre-push`              |
