variable "aws_region" {
  description = "AWS region used by the development account. Budgets itself is global."
  type        = string
  default     = "us-east-1"
}

variable "budget_alert_email" {
  description = "Email address that receives the four development budget alerts."
  type        = string

  validation {
    condition     = can(regex("^[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+$", var.budget_alert_email))
    error_message = "budget_alert_email must be a valid email address."
  }
}

variable "budget_limit_usd" {
  description = "Hard monthly planning limit for the development environment."
  type        = number
  default     = 20

  validation {
    condition     = var.budget_limit_usd == 20
    error_message = "The accepted ADR fixes the DEV budget limit at USD 20."
  }
}

variable "budget_alert_thresholds_usd" {
  description = "Absolute actual-cost alert thresholds in USD."
  type        = set(number)
  default     = [10, 15, 18, 20]

  validation {
    condition     = var.budget_alert_thresholds_usd == toset([10, 15, 18, 20])
    error_message = "DEV alerts must remain at USD 10, 15, 18 and 20."
  }
}
