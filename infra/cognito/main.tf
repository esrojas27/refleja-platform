provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Application = "refleja-tu-interior"
      Environment = "development"
      ManagedBy   = "terraform"
    }
  }
}

resource "aws_sesv2_email_identity" "invitation_sender" {
  count          = var.ses_sender_email == null ? 0 : 1
  email_identity = var.ses_sender_email
}

resource "aws_cognito_user_pool" "development" {
  name = "${var.resource_prefix}-development"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration        = "OFF"

  username_configuration {
    case_sensitive = false
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  dynamic "email_configuration" {
    for_each = var.enable_ses_delivery ? [var.ses_sender_email] : []
    content {
      email_sending_account = "DEVELOPER"
      from_email_address    = email_configuration.value
      source_arn            = aws_sesv2_email_identity.invitation_sender[0].arn
    }
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.resource_prefix}-web-development"
  user_pool_id = aws_cognito_user_pool.development.id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid"]
  callback_urls                        = var.callback_urls
  logout_urls                          = var.logout_urls
  default_redirect_uri                 = var.callback_urls[0]
  supported_identity_providers         = ["COGNITO"]
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_pool_domain" "development" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.development.id
}
