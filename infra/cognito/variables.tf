variable "aws_region" {
  description = "AWS region for the development Cognito User Pool."
  type        = string

  validation {
    condition     = length(trimspace(var.aws_region)) > 0
    error_message = "aws_region must not be empty."
  }
}

variable "resource_prefix" {
  description = "Short prefix used to identify Refleja Tu Interior resources."
  type        = string
  default     = "rti"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.resource_prefix))
    error_message = "resource_prefix may contain lowercase letters, numbers and hyphens only."
  }
}

variable "cognito_domain_prefix" {
  description = "Globally unique prefix for the Cognito managed login domain."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.cognito_domain_prefix))
    error_message = "cognito_domain_prefix may contain lowercase letters, numbers and hyphens only."
  }
}

variable "callback_urls" {
  description = "Exact browser URLs Cognito may redirect to after authentication."
  type        = list(string)
  default     = ["http://localhost:3000/account"]

  validation {
    condition = length(var.callback_urls) > 0 && alltrue([
      for url in var.callback_urls : startswith(url, "https://") || startswith(url, "http://localhost:")
    ])
    error_message = "callback_urls must contain at least one HTTPS or localhost URL."
  }
}

variable "logout_urls" {
  description = "Exact browser URLs Cognito may redirect to after logout."
  type        = list(string)
  default     = ["http://localhost:3000/login"]

  validation {
    condition = length(var.logout_urls) > 0 && alltrue([
      for url in var.logout_urls : startswith(url, "https://") || startswith(url, "http://localhost:")
    ])
    error_message = "logout_urls must contain at least one HTTPS or localhost URL."
  }
}

variable "ses_sender_email" {
  description = "Optional email identity used by Cognito and the API for development invitations. It must be verified before enabling delivery."
  type        = string
  default     = null

  validation {
    condition     = var.ses_sender_email == null || can(regex("^[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+$", var.ses_sender_email))
    error_message = "ses_sender_email must be null or a valid email address."
  }
}

variable "enable_ses_delivery" {
  description = "Configure Cognito to use the verified SES sender. Enable only after AWS reports the identity as verified."
  type        = bool
  default     = false

  validation {
    condition     = !var.enable_ses_delivery || var.ses_sender_email != null
    error_message = "enable_ses_delivery requires ses_sender_email."
  }
}
