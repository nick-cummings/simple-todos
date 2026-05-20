locals {
  has_git_repo          = var.github_repo != ""
  has_domain            = var.custom_domain != ""
  has_anthropic_api_key = var.anthropic_api_key != ""
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
