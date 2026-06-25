# Gestion des secrets via Google Secret Manager.
# Les valeurs arrivent par variables (terraform.tfvars en local / TF_VAR_* en CI),
# sont stockées dans Secret Manager, puis injectées dans Cloud Run via value_source.
data "google_project" "this" {}

locals {
  # Compte de service d'exécution par défaut de Cloud Run (compute par défaut).
  runtime_sa = "${data.google_project.this.number}-compute@developer.gserviceaccount.com"

  secrets = {
    DATABASE_URL          = var.database_url
    JWT_SECRET            = var.jwt_secret
    AWS_ACCESS_KEY_ID     = var.aws_access_key_id
    AWS_SECRET_ACCESS_KEY = var.aws_secret_access_key
  }
}

resource "google_secret_manager_secret" "s" {
  for_each  = local.secrets
  secret_id = "projet-cloud-${lower(each.key)}"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "v" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.s[each.key].id
  secret_data = each.value
}

# Autorise le SA d'exécution Cloud Run à lire chaque secret.
resource "google_secret_manager_secret_iam_member" "access" {
  for_each  = local.secrets
  secret_id = google_secret_manager_secret.s[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.runtime_sa}"
}
