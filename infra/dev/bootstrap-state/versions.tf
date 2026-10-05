terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Application = "refleja-tu-interior"
      Environment = "development"
      ManagedBy   = "terraform"
      BudgetScope = "rti-dev"
    }
  }
}
