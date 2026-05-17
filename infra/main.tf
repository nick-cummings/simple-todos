locals {
  has_git_repo = var.github_repo != ""
  has_domain   = var.custom_domain != ""
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

  # No env vars required for the MVP — todos live in localStorage.
}

resource "vercel_project_domain" "primary" {
  count   = local.has_domain ? 1 : 0
  project_id = vercel_project.app.id
  domain     = var.custom_domain
}
