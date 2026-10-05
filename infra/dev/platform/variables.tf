variable "aws_region" {
  description = "AWS region for the DEV platform."
  type        = string
  default     = "us-east-1"
}

variable "resource_prefix" {
  description = "Name prefix for DEV resources."
  type        = string
  default     = "rti-dev"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.resource_prefix))
    error_message = "resource_prefix must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "vpc_cidr" {
  description = "CIDR for the small, single-AZ DEV VPC."
  type        = string
  default     = "10.42.0.0/24"
}

variable "public_subnet_cidr" {
  description = "CIDR for the public DEV subnet."
  type        = string
  default     = "10.42.0.0/25"
}

variable "availability_zone" {
  description = "Optional AZ override. The first available AZ is used when null."
  type        = string
  default     = null
  nullable    = true
}

variable "allowed_ingress_cidrs" {
  description = "CIDRs allowed to reach HTTP and HTTPS. Keep public access only while DEV needs external testers."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "instance_type" {
  description = "ARM64 EC2 instance size. t4g.small is the budget baseline."
  type        = string
  default     = "t4g.small"

  validation {
    condition     = startswith(var.instance_type, "t4g.")
    error_message = "The initial DEV platform supports ARM64 t4g instance types."
  }
}

variable "root_volume_size_gib" {
  description = "Encrypted gp3 root volume size."
  type        = number
  default     = 16

  validation {
    condition     = var.root_volume_size_gib >= 8
    error_message = "root_volume_size_gib must be at least 8 GiB."
  }
}

variable "data_volume_size_gib" {
  description = "Encrypted gp3 data volume for Docker and PostgreSQL data."
  type        = number
  default     = 25

  validation {
    condition     = var.data_volume_size_gib >= 10
    error_message = "data_volume_size_gib must be at least 10 GiB."
  }
}

variable "ecr_image_retention_count" {
  description = "Number of tagged images kept per ECR repository."
  type        = number
  default     = 10

  validation {
    condition     = var.ecr_image_retention_count >= 3
    error_message = "Retain at least three tagged images for rollback."
  }
}

variable "backup_noncurrent_retention_days" {
  description = "Days to keep noncurrent backup object versions."
  type        = number
  default     = 30
}

variable "ssm_parameter_path" {
  description = "Path reserved for runtime configuration and secrets. Values are created outside Terraform."
  type        = string
  default     = "/refleja-tu-interior/dev"

  validation {
    condition     = startswith(var.ssm_parameter_path, "/")
    error_message = "ssm_parameter_path must start with '/'."
  }
}

variable "cognito_user_pool_arn" {
  description = "Existing Cognito user pool ARN used by invitation delivery."
  type        = string

  validation {
    condition     = can(regex("^arn:[^:]+:cognito-idp:[^:]+:[0-9]{12}:userpool/.+$", var.cognito_user_pool_arn))
    error_message = "cognito_user_pool_arn must be a Cognito user pool ARN."
  }
}

variable "ses_identity_arns" {
  description = "Verified SES email/domain identity ARNs authorized during sender rotation."
  type        = set(string)

  validation {
    condition = length(var.ses_identity_arns) > 0 && alltrue([
      for arn in var.ses_identity_arns : can(regex("^arn:[^:]+:ses:[^:]+:[0-9]{12}:identity/.+$", arn))
    ])
    error_message = "Provide at least one valid SES identity ARN."
  }
}

variable "invitation_sender_email" {
  description = "Active From address stored in Parameter Store for invitation delivery."
  type        = string

  validation {
    condition     = can(regex("^[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+$", var.invitation_sender_email))
    error_message = "invitation_sender_email must be a valid email address."
  }
}

variable "route53_zone_id" {
  description = "Optional Route 53 hosted zone ID. Set together with dev_hostname."
  type        = string
  default     = null
  nullable    = true
}

variable "dev_hostname" {
  description = "Optional fully qualified DEV hostname. It may use external DNS; set route53_zone_id only when Terraform should create the record."
  type        = string
  default     = null
  nullable    = true
}

variable "schedule_enabled" {
  description = "Enable weekday automatic start and stop schedules."
  type        = bool
  default     = true
}

variable "schedule_timezone" {
  description = "IANA timezone for the EC2 schedules."
  type        = string
  default     = "America/Bogota"
}

variable "weekday_start_cron" {
  description = "EventBridge Scheduler cron for weekday startup."
  type        = string
  default     = "cron(0 8 ? * MON-FRI *)"
}

variable "weekday_stop_cron" {
  description = "EventBridge Scheduler cron for weekday shutdown."
  type        = string
  default     = "cron(0 20 ? * MON-FRI *)"
}

variable "github_oidc_provider_arn" {
  description = "Existing GitHub Actions OIDC provider ARN in the AWS account."
  type        = string

  validation {
    condition     = can(regex("^arn:[^:]+:iam::[0-9]{12}:oidc-provider/token\\.actions\\.githubusercontent\\.com$", var.github_oidc_provider_arn))
    error_message = "github_oidc_provider_arn must identify the GitHub Actions OIDC provider."
  }
}

variable "github_repository_subject_prefix" {
  description = "Immutable GitHub OIDC repository subject prefix configured for this repository."
  type        = string

  validation {
    condition     = startswith(var.github_repository_subject_prefix, "repo:")
    error_message = "github_repository_subject_prefix must start with repo:."
  }
}

variable "github_deployment_environment" {
  description = "GitHub environment allowed to assume the DEV deployment role."
  type        = string
  default     = "development"

  validation {
    condition     = can(regex("^[A-Za-z0-9_-]+$", var.github_deployment_environment))
    error_message = "github_deployment_environment contains unsupported characters."
  }
}
