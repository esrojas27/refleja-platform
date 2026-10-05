output "state_bucket_name" {
  description = "Bucket to place in platform/backend.hcl."
  value       = aws_s3_bucket.terraform_state.id
}

output "backend_hcl" {
  description = "Backend configuration values for the DEV platform root."
  value = {
    bucket       = aws_s3_bucket.terraform_state.id
    key          = "development/platform.tfstate"
    region       = var.aws_region
    encrypt      = true
    use_lockfile = true
  }
}
