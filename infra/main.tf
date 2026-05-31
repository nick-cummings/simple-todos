locals {
  has_git_repo          = var.github_repo != ""
  has_domain            = var.custom_domain != ""
  has_anthropic_api_key = var.anthropic_api_key != ""
  has_upstash_creds     = var.upstash_email != "" && var.upstash_api_key != ""
  has_vapid             = var.vapid_public_key != "" && var.vapid_private_key != ""
  has_cron_secret       = var.cron_secret != ""
  has_sentry_dsn        = var.sentry_dsn != ""
  has_sentry_sourcemaps = var.sentry_auth_token != "" && var.sentry_org != "" && var.sentry_project != ""
  has_pipeline_secret   = var.github_repo != "" && var.claude_code_oauth_token != ""
}

resource "vercel_project" "app" {
  name      = var.project_name
  framework = "nextjs"

  # Expose Vercel's system env vars (VERCEL_ENV, VERCEL_URL, VERCEL_GIT_*, …)
  # to both the build and the runtime. VERCEL_ENV ("production" | "preview" |
  # "development") is the canonical "which environment am I in?" signal: the
  # mockups gate (`mockupsEnabled()`, see docs/architecture.md) reads it to
  # render `/mockups/*` on preview deploys but 404 them in production, and any
  # future preview-only feature can gate on the same var instead of minting a
  # bespoke per-feature flag. These are non-secret platform values.
  automatically_expose_system_environment_variables = true

  # Path is relative to the connected repo root.
  root_directory = null

  # Production branch follows the connected git repo.
  git_repository = local.has_git_repo ? {
    type              = "github"
    repo              = var.github_repo
    production_branch = var.production_branch
  } : null

  # Public deploys: disable Vercel SSO so anonymous clients can hit
  # the site and the /api/generate-description route. Abuse protection
  # for the AI route is handled in the route itself (per-IP rate limit).
  vercel_authentication = {
    deployment_type = "none"
  }
}

resource "vercel_project_domain" "primary" {
  count      = local.has_domain ? 1 : 0
  project_id = vercel_project.app.id
  domain     = var.custom_domain
}

# Env vars. Keep one resource per var so additions/removals don't churn
# unrelated state. Mark sensitive so plan/state never echoes the value.
resource "vercel_project_environment_variable" "anthropic_api_key" {
  count      = local.has_anthropic_api_key ? 1 : 0
  project_id = vercel_project.app.id
  key        = "ANTHROPIC_API_KEY"
  value      = var.anthropic_api_key
  target     = ["production", "preview"]
  sensitive  = true
}

# Upstash Redis for cross-instance rate limiting on the AI route.
# Terraform provisions the DB itself and feeds its REST endpoint+token
# into the Vercel project as env vars. Gated on credentials being
# present so a fresh clone without Upstash creds still plans cleanly
# (the route falls back to an in-memory limiter).
resource "upstash_redis_database" "ratelimit" {
  count         = local.has_upstash_creds ? 1 : 0
  database_name = "${var.project_name}-ratelimit"
  # Upstash deprecated single-region "regional" databases in favor of
  # "global" databases that pick a primary + replicas. region="global"
  # tells the API to provision a global DB; primary_region picks the
  # write region; read_regions is empty since we only need one region
  # for rate-limiting.
  region         = "global"
  primary_region = var.upstash_redis_region
  read_regions   = []
  tls            = true
  eviction       = false
}

resource "vercel_project_environment_variable" "upstash_redis_rest_url" {
  count      = local.has_upstash_creds ? 1 : 0
  project_id = vercel_project.app.id
  key        = "UPSTASH_REDIS_REST_URL"
  value      = "https://${upstash_redis_database.ratelimit[0].endpoint}"
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "upstash_redis_rest_token" {
  count      = local.has_upstash_creds ? 1 : 0
  project_id = vercel_project.app.id
  key        = "UPSTASH_REDIS_REST_TOKEN"
  value      = upstash_redis_database.ratelimit[0].rest_token
  target     = ["production", "preview"]
  sensitive  = true
}

# VAPID keys for Web Push reminders. Generated locally via
# `node scripts/generate-vapid-keys.mjs`; the public key is shipped
# to the browser (via NEXT_PUBLIC_*), the private key never leaves
# the function runtime. Rotating these invalidates every active
# push subscription.
resource "vercel_project_environment_variable" "vapid_public_key" {
  count      = local.has_vapid ? 1 : 0
  project_id = vercel_project.app.id
  key        = "NEXT_PUBLIC_VAPID_PUBLIC_KEY"
  value      = var.vapid_public_key
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "vapid_private_key" {
  count      = local.has_vapid ? 1 : 0
  project_id = vercel_project.app.id
  key        = "VAPID_PRIVATE_KEY"
  value      = var.vapid_private_key
  target     = ["production", "preview"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "vapid_subject" {
  count      = local.has_vapid ? 1 : 0
  project_id = vercel_project.app.id
  key        = "VAPID_SUBJECT"
  value      = var.vapid_subject
  target     = ["production", "preview"]
}

# Shared secret used to gate /api/push/notify-cron. Vercel Cron
# automatically attaches `Authorization: Bearer $CRON_SECRET` when
# this env var is set in the project, so the cron handler can
# reject random unauthenticated hits.
resource "vercel_project_environment_variable" "cron_secret" {
  count      = local.has_cron_secret ? 1 : 0
  project_id = vercel_project.app.id
  key        = "CRON_SECRET"
  value      = var.cron_secret
  target     = ["production", "preview"]
  sensitive  = true
}

# Sentry. The DSN ships to the client as NEXT_PUBLIC_SENTRY_DSN so the
# @sentry/nextjs SDK can initialize in the browser; the auth-token
# trio is build-time-only for source map upload via withSentryConfig.
# All four are independently optional — see [ADR 0011].
resource "vercel_project_environment_variable" "sentry_dsn" {
  count      = local.has_sentry_dsn ? 1 : 0
  project_id = vercel_project.app.id
  key        = "NEXT_PUBLIC_SENTRY_DSN"
  value      = var.sentry_dsn
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "sentry_auth_token" {
  count      = local.has_sentry_sourcemaps ? 1 : 0
  project_id = vercel_project.app.id
  key        = "SENTRY_AUTH_TOKEN"
  value      = var.sentry_auth_token
  target     = ["production", "preview"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "sentry_org" {
  count      = local.has_sentry_sourcemaps ? 1 : 0
  project_id = vercel_project.app.id
  key        = "SENTRY_ORG"
  value      = var.sentry_org
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "sentry_project" {
  count      = local.has_sentry_sourcemaps ? 1 : 0
  project_id = vercel_project.app.id
  key        = "SENTRY_PROJECT"
  value      = var.sentry_project
  target     = ["production", "preview"]
}

# GitHub Actions secret for the two-agent auto-pipeline. The
# implementer + reviewer workflows authenticate the model against a
# Claude Max subscription via this OAuth token (see
# docs/two-agent-auto-pipeline.md, "Model auth: Max subscription
# trial"). Managing it here keeps the repo as the source of truth: the
# value lives in the git-ignored terraform.tfvars, the binding lives
# here, and `terraform apply` pushes it to GitHub. The plaintext lands
# only in local (git-ignored) state, same as every sensitive var above.
resource "github_actions_secret" "claude_code_oauth_token" {
  count       = local.has_pipeline_secret ? 1 : 0
  repository  = split("/", var.github_repo)[1]
  secret_name = "CLAUDE_CODE_OAUTH_TOKEN"
  value       = var.claude_code_oauth_token
}
