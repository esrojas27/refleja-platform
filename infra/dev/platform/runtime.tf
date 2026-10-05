locals {
  invitation_sender_email  = lower(trimspace(var.invitation_sender_email))
  invitation_sender_domain = split("@", local.invitation_sender_email)[1]
}

check "invitation_sender_is_authorized" {
  assert {
    condition = anytrue([
      for arn in var.ses_identity_arns :
      endswith(lower(arn), "identity/${local.invitation_sender_email}") ||
      endswith(lower(arn), "identity/${local.invitation_sender_domain}")
    ])
    error_message = "The active invitation sender must match an authorized SES email or domain identity ARN."
  }
}

resource "aws_ssm_parameter" "invitation_sender_email" {
  name        = "${var.ssm_parameter_path}/INVITATIONS_SES_FROM"
  description = "Active From address for Refleja Tu Interior invitation email."
  type        = "String"
  value       = local.invitation_sender_email
  tier        = "Standard"

  tags = {
    Name = "${var.resource_prefix}-invitation-sender"
  }
}
