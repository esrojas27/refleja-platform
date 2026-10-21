# Small-pilot monitoring: immediate script failure plus missing-success detection
# even when the instance/timer is not running. Three days tolerate the weekend.
resource "aws_sns_topic" "backup_alerts" {
  name = "${var.resource_prefix}-backup-alerts"
}

resource "aws_sns_topic_subscription" "backup_email" {
  topic_arn = aws_sns_topic.backup_alerts.arn
  protocol  = "email"
  endpoint  = var.backup_alert_email
}

resource "aws_cloudwatch_metric_alarm" "backup_missing" {
  alarm_name          = "${var.resource_prefix}-backup-missing"
  alarm_description   = "No successful PostgreSQL backup in three daily periods. Check SSM and refleja-backup.timer; weekends intentionally tolerated."
  namespace           = "Refleja/Backup"
  metric_name         = "Success"
  statistic           = "Sum"
  period              = 86400
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  dimensions          = { Environment = "development" }
  alarm_actions       = [aws_sns_topic.backup_alerts.arn]
  ok_actions          = [aws_sns_topic.backup_alerts.arn]
}

output "backup_alert_topic_arn" {
  value       = aws_sns_topic.backup_alerts.arn
  description = "Backup failure and freshness alerts. Email subscription must be confirmed."
}
