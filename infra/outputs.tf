output "project_id" {
  description = "Vercel project ID."
  value       = vercel_project.app.id
}

output "project_name" {
  description = "Vercel project name."
  value       = vercel_project.app.name
}

output "default_url" {
  description = "Default vercel.app URL (after first deploy)."
  value       = "https://${vercel_project.app.name}.vercel.app"
}

output "custom_domain" {
  description = "Configured custom domain, if any."
  value       = local.has_domain ? var.custom_domain : null
}
