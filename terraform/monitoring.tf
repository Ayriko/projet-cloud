# Observabilité : uptime check + alert policy par microservice, + un dashboard global.

locals {
  # Cible d'uptime par service (host = domaine Cloud Run sans le https://).
  uptime_targets = {
    auth = {
      host = replace(google_cloud_run_v2_service.auth.uri, "https://", "")
      path = "/healthz/live"
    }
    core = {
      host = replace(google_cloud_run_v2_service.core.uri, "https://", "")
      path = "/healthz/live"
    }
    "frontend-app" = {
      host = replace(google_cloud_run_v2_service.frontend.uri, "https://", "")
      path = "/"
    }
  }

  mon_services = ["auth", "core", "frontend-app"]

  # Deux tuiles par service : trafic par code HTTP + latence p99.
  dashboard_widgets = flatten([
    for svc in local.mon_services : [
      {
        title = "Requêtes/s par code — ${svc}"
        xyChart = {
          dataSets = [{
            plotType = "STACKED_BAR"
            timeSeriesQuery = {
              timeSeriesFilter = {
                filter = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${svc}\""
                aggregation = {
                  alignmentPeriod    = "60s"
                  perSeriesAligner   = "ALIGN_RATE"
                  crossSeriesReducer = "REDUCE_SUM"
                  groupByFields      = ["metric.label.\"response_code_class\""]
                }
              }
            }
          }]
          yAxis = { label = "req/s", scale = "LINEAR" }
        }
      },
      {
        title = "Latence p99 (ms) — ${svc}"
        xyChart = {
          dataSets = [{
            plotType = "LINE"
            timeSeriesQuery = {
              timeSeriesFilter = {
                filter = "metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${svc}\""
                aggregation = {
                  alignmentPeriod  = "60s"
                  perSeriesAligner = "ALIGN_PERCENTILE_99"
                }
              }
            }
          }]
          yAxis = { label = "ms", scale = "LINEAR" }
        }
      }
    ]
  ])
}

# --- Uptime checks (1 par service) ---
resource "google_monitoring_uptime_check_config" "svc" {
  for_each = local.uptime_targets

  display_name = "${each.key} uptime"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = each.value.path
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = each.value.host
    }
  }
}

# --- Alert policies (alerte si un service ne répond plus) ---
resource "google_monitoring_alert_policy" "svc_down" {
  for_each = local.uptime_targets

  display_name = "${each.key} down"
  combiner     = "OR"

  conditions {
    display_name = "${each.key} uptime failing"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.\"check_id\"=\"${google_monitoring_uptime_check_config.svc[each.key].uptime_check_id}\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "300s"
      trigger {
        count = 1
      }
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_FRACTION_TRUE"
      }
    }
  }
}

# --- Dashboard global (trafic + latence par service) ---
resource "google_monitoring_dashboard" "services" {
  dashboard_json = jsonencode({
    displayName = "projet-cloud — microservices"
    gridLayout = {
      columns = "2"
      widgets = local.dashboard_widgets
    }
  })
}
