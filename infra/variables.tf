variable "vercel_api_token" {
  description = "Vercel API token (https://vercel.com/account/tokens). Provide via TF_VAR_vercel_api_token."
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Optional Vercel team ID. Leave empty to deploy under the personal account."
  type        = string
  default     = ""
}

variable "project_name" {
  description = "Vercel project name (also used as the default subdomain)."
  type        = string
  default     = "simple-todos"
}

variable "github_repo" {
  description = "GitHub repo in owner/name form, e.g. nickcummings/simple-todos. Leave empty to skip Git wiring."
  type        = string
  default     = ""
}

variable "production_branch" {
  description = "Branch that triggers production deploys."
  type        = string
  default     = "main"
}

variable "custom_domain" {
  description = "Optional custom domain to attach to the project. Leave empty to use the default *.vercel.app domain."
  type        = string
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key for /api/generate-description. Leave empty to skip provisioning the env var on Vercel (the route will then return a 503 in production). Provide via TF_VAR_anthropic_api_key or terraform.tfvars."
  type        = string
  default     = ""
  sensitive   = true
}

variable "upstash_email" {
  description = "Upstash account email. Together with upstash_api_key, lets Terraform provision the Redis DB itself and wire its endpoint into Vercel env vars. Leave empty to skip — the route falls back to its in-memory limiter."
  type        = string
  default     = ""
}

variable "upstash_api_key" {
  description = "Upstash management API key from https://console.upstash.com/account/api. Used to provision the Redis DB."
  type        = string
  default     = ""
  sensitive   = true
}

variable "upstash_redis_region" {
  description = "AWS region for the Upstash Redis DB. Choose one close to where the Vercel functions run (sfo1 ≈ us-west-1, iad1 ≈ us-east-1)."
  type        = string
  default     = "us-east-1"
}

variable "vapid_public_key" {
  description = "Web Push VAPID public key. Generate with `node scripts/generate-vapid-keys.mjs`. Shipped to the client as NEXT_PUBLIC_VAPID_PUBLIC_KEY. Leave empty to skip provisioning (the reminders feature degrades gracefully)."
  type        = string
  default     = ""
}

variable "vapid_private_key" {
  description = "Web Push VAPID private key. Stored as a sensitive Vercel env var; never leaves the server. Rotating this invalidates every active push subscription."
  type        = string
  default     = ""
  sensitive   = true
}

variable "vapid_subject" {
  description = "VAPID contact (mailto: or https://) advertised to push services. Used by web-push when sending notifications."
  type        = string
  default     = "mailto:nickcummings21@gmail.com"
}

variable "cron_secret" {
  description = "Random 32+ char secret. /api/push/notify-cron rejects any request without `Authorization: Bearer $CRON_SECRET`. Vercel Cron injects this header automatically when CRON_SECRET is set in the project env."
  type        = string
  default     = ""
  sensitive   = true
}
