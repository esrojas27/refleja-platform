output "instance_id" {
  description = "DEV EC2 instance managed through Systems Manager."
  value       = aws_instance.application.id
}

output "public_ip" {
  description = "Stable public IPv4 address."
  value       = aws_eip.application.public_ip
}

output "application_url" {
  description = "Expected DEV URL. HTTPS becomes available after the application is deployed."
  value       = var.dev_hostname == null ? "http://${aws_eip.application.public_ip}" : "https://${var.dev_hostname}"
}

output "ecr_repository_urls" {
  description = "Immutable ARM64 container image repositories."
  value       = { for name, repository in aws_ecr_repository.application : name => repository.repository_url }
}

output "backup_bucket_name" {
  description = "Private S3 destination reserved for database backups."
  value       = aws_s3_bucket.backups.id
}

output "ssm_parameter_path" {
  description = "Runtime configuration path that deployment automation may read."
  value       = var.ssm_parameter_path
}

output "invitation_sender_parameter" {
  description = "Parameter Store key read by deployment automation for INVITATIONS_SES_FROM."
  value       = aws_ssm_parameter.invitation_sender_email.name
}

output "authorized_ses_identity_arns" {
  description = "SES identities accepted during the current sender transition."
  value       = var.ses_identity_arns
}

output "session_manager_command" {
  description = "Administrative access command; no inbound SSH is exposed."
  value       = "aws ssm start-session --target ${aws_instance.application.id} --region ${var.aws_region}"
}

output "schedule" {
  description = "Cost-control window for the DEV instance."
  value = var.schedule_enabled ? {
    timezone = var.schedule_timezone
    start    = var.weekday_start_cron
    stop     = var.weekday_stop_cron
  } : null
}

output "github_deployment_role_arn" {
  description = "OIDC role used by the protected GitHub DEV deployment environment."
  value       = aws_iam_role.github_deploy.arn
}
