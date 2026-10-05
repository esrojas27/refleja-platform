provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Application = "refleja-tu-interior"
      Environment = "development"
      BudgetScope = "rti-dev"
      ManagedBy   = "terraform"
    }
  }
}

resource "aws_budgets_budget" "development" {
  name         = "refleja-tu-interior-development"
  budget_type  = "COST"
  limit_amount = tostring(var.budget_limit_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:BudgetScope$rti-dev"]
  }

  dynamic "notification" {
    for_each = var.budget_alert_thresholds_usd
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "ABSOLUTE_VALUE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.budget_alert_email]
    }
  }
}
