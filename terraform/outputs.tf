output "auth_url" {
  value = google_cloud_run_v2_service.auth.uri
}

output "core_url" {
  value = google_cloud_run_v2_service.core.uri
}

output "frontend_url" {
  value = google_cloud_run_v2_service.frontend.uri
}

# redeploy trigger
