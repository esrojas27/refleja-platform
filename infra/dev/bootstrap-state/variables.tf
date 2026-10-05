variable "aws_region" {
  description = "AWS region that stores the remote Terraform state."
  type        = string
  default     = "us-east-1"
}

variable "resource_prefix" {
  description = "Prefix used for the globally unique state bucket."
  type        = string
  default     = "refleja-tu-interior-dev"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.resource_prefix))
    error_message = "resource_prefix must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "noncurrent_version_retention_days" {
  description = "Days to retain noncurrent state object versions."
  type        = number
  default     = 90

  validation {
    condition     = var.noncurrent_version_retention_days >= 30
    error_message = "Keep at least 30 days of noncurrent state versions."
  }
}
