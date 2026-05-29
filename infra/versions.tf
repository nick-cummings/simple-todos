terraform {
  required_version = ">= 1.6.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 2.0"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.5"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  # Local state by default. To use a remote backend, swap this block.
  # All configuration intentionally lives in this repo (no .terraformrc, no tfvars
  # outside infra/). See terraform.tfvars.example for required inputs.
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id != "" ? var.vercel_team_id : null
}

provider "upstash" {
  email   = var.upstash_email
  api_key = var.upstash_api_key
}

provider "github" {
  # Owner is derived from github_repo (owner/name form). The token is
  # used only to manage this repo's Actions secrets: set var.github_token
  # (in the git-ignored terraform.tfvars), or leave it empty and fall
  # back to the GITHUB_TOKEN env var, e.g. `export GITHUB_TOKEN=$(gh auth token)`.
  owner = var.github_repo != "" ? split("/", var.github_repo)[0] : null
  token = var.github_token != "" ? var.github_token : null
}
