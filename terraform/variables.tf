variable "project_id" {
  type    = string
  default = "cloud-ynov-494711"
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "repo" {
  description = "Dépôt Artifact Registry (réutilisé)"
  type        = string
  default     = "demo"
}

variable "image_tag" {
  description = "Tag des images à déployer (SHA du commit, fourni par la CI)"
  type        = string
  default     = "latest"
}

# --- Secrets (passés via terraform.tfvars en local, ou TF_VAR_* en CI) ---
variable "database_url" {
  type      = string
  sensitive = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "aws_access_key_id" {
  type      = string
  sensitive = true
}

variable "aws_secret_access_key" {
  type      = string
  sensitive = true
}

# --- Config non sensible ---
variable "aws_default_region" {
  type    = string
  default = "eu-west-3"
}

variable "s3_bucket" {
  type    = string
  default = "demo-cloud-763749302763-eu-west-3-an"
}
