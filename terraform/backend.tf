# State distant partagé (réutilise le bucket existant, nouveau prefix dédié au projet).
terraform {
  backend "gcs" {
    bucket = "cloud-ynov-494711-tfstate"
    prefix = "projet-cloud"
  }
}
