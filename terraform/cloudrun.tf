locals {
  image_base = "${var.region}-docker.pkg.dev/${var.project_id}/${var.repo}"
}

# ---------------------------------------------------------------------------
# Auth Service
# ---------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "auth" {
  name                = "auth"
  location            = var.region
  deletion_protection = false

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 4
    }

    containers {
      image = "${local.image_base}/auth:${var.image_tag}"

      ports {
        container_port = 8080
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.s["DATABASE_URL"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.s["JWT_SECRET"].secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/healthz/ready"
          port = 8080
        }
        # Tolérant au cold start de Neon (free tier en veille) : jusqu'à ~120s
        # pour devenir prêt, mais une mauvaise config DB échoue quand même.
        initial_delay_seconds = 5
        timeout_seconds       = 10
        period_seconds        = 15
        failure_threshold     = 8
      }
      liveness_probe {
        http_get {
          path = "/healthz/live"
          port = 8080
        }
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  depends_on = [google_secret_manager_secret_iam_member.access]
}

# ---------------------------------------------------------------------------
# Core Service (appelle Auth via AUTH_URL)
# ---------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "core" {
  name                = "core"
  location            = var.region
  deletion_protection = false

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 4
    }

    containers {
      image = "${local.image_base}/core:${var.image_tag}"

      ports {
        container_port = 8080
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.s["DATABASE_URL"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "AWS_ACCESS_KEY_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.s["AWS_ACCESS_KEY_ID"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "AWS_SECRET_ACCESS_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.s["AWS_SECRET_ACCESS_KEY"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "AWS_DEFAULT_REGION"
        value = var.aws_default_region
      }
      env {
        name  = "S3_BUCKET"
        value = var.s3_bucket
      }
      env {
        name  = "AUTH_URL"
        value = google_cloud_run_v2_service.auth.uri
      }

      startup_probe {
        http_get {
          path = "/healthz/ready"
          port = 8080
        }
        # Tolérant au cold start de Neon (free tier en veille) : jusqu'à ~120s
        # pour devenir prêt, mais une mauvaise config DB échoue quand même.
        initial_delay_seconds = 5
        timeout_seconds       = 10
        period_seconds        = 15
        failure_threshold     = 8
      }
      liveness_probe {
        http_get {
          path = "/healthz/live"
          port = 8080
        }
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  depends_on = [google_secret_manager_secret_iam_member.access]
}

# ---------------------------------------------------------------------------
# Frontend (reçoit les URLs des 2 APIs)
# ---------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "frontend" {
  name                = "frontend-app"
  location            = var.region
  deletion_protection = false

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 4
    }

    containers {
      image = "${local.image_base}/frontend:${var.image_tag}"

      ports {
        container_port = 8080
      }

      env {
        name  = "AUTH_URL"
        value = google_cloud_run_v2_service.auth.uri
      }
      env {
        name  = "CORE_URL"
        value = google_cloud_run_v2_service.core.uri
      }

      startup_probe {
        http_get {
          path = "/"
          port = 8080
        }
        initial_delay_seconds = 0
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 3
      }
    }
  }
}

# ---------------------------------------------------------------------------
# Accès public (les 3 services sont appelés depuis le navigateur)
# ---------------------------------------------------------------------------
resource "google_cloud_run_v2_service_iam_member" "auth_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.auth.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "core_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.core.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
