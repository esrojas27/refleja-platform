# Mocked plans only: no AWS calls, actual users, identities or messages.
mock_provider "aws" {
  mock_data "aws_sesv2_email_identity" {
    defaults = {
      arn                         = "arn:aws:ses:us-east-1:123456789012:identity/corporate@example.test"
      verified_for_sending_status = true
    }
  }
}

variables {
  aws_region                = "us-east-1"
  cognito_domain_prefix     = "sender-rotation-test"
  ses_sender_email          = "original@example.test"
  ses_delivery_sender_email = null
  enable_ses_delivery       = true
}

run "retains_original_sender_without_override" {
  command = plan
  assert {
    condition     = one(aws_cognito_user_pool.development.email_configuration).from_email_address == "original@example.test"
    error_message = "Omitting the override must preserve the managed sender behavior."
  }
  assert {
    condition     = length(data.aws_sesv2_email_identity.delivery_sender) == 0
    error_message = "The legacy path must not require an external SES identity."
  }
}

run "rotates_to_verified_sender_without_replacing_original_identity" {
  command = plan
  variables {
    ses_delivery_sender_email = "corporate@example.test"
  }
  assert {
    condition     = one(aws_cognito_user_pool.development.email_configuration).from_email_address == "corporate@example.test"
    error_message = "Cognito must use the external corporate sender."
  }
  assert {
    condition     = one(aws_cognito_user_pool.development.email_configuration).source_arn == "arn:aws:ses:us-east-1:123456789012:identity/corporate@example.test"
    error_message = "Cognito must authorize the selected verified identity."
  }
  assert {
    condition     = aws_sesv2_email_identity.invitation_sender[0].email_identity == "original@example.test"
    error_message = "Rotation must retain the original managed identity for rollback."
  }
}

run "rejects_an_unverified_external_sender" {
  command = plan
  variables {
    ses_delivery_sender_email = "unverified@example.test"
  }
  override_data {
    target = data.aws_sesv2_email_identity.delivery_sender[0]
    values = {
      arn                         = "arn:aws:ses:us-east-1:123456789012:identity/unverified@example.test"
      verified_for_sending_status = false
    }
  }
  expect_failures = [data.aws_sesv2_email_identity.delivery_sender[0]]
}

run "keeps_ses_optional" {
  command = plan
  variables {
    ses_sender_email    = null
    enable_ses_delivery = false
  }
  assert {
    condition     = length(aws_cognito_user_pool.development.email_configuration) == 0 && length(aws_sesv2_email_identity.invitation_sender) == 0
    error_message = "Existing installations without SES must remain supported."
  }
}
