locals {
  has_git_repo          = var.github_repo != ""
  has_domain            = var.custom_domain != ""
  has_anthropic_api_key = var.anthropic_api_key != ""
  has_upstash_creds     = var.upstash_email != "" && var.upstash_api_key != ""
  has_vapid             = var.vapid_public_key != "" && var.vapid_private_key != ""
  has_cron_secret       = var.cron_secret != ""
}

resource "vercel_project" "app" {
  name      = var.project_name
  framework = "nextjs"

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
  count          = local.has_upstash_creds ? 1 : 0
  database_name  = "${var.project_name}-ratelimit"
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
