data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_instance" "application" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.application.id]
  iam_instance_profile   = aws_iam_instance_profile.application.name

  # A launch-time address gives cloud-init outbound access before the stable
  # Elastic IP association is completed. The EIP replaces it immediately.
  associate_public_ip_address = true
  disable_api_stop            = false
  # DEV must remain replaceable while the product is changing rapidly.
  # Persistent data lives on the separate EBS volume and backups live in S3.
  disable_api_termination              = false
  instance_initiated_shutdown_behavior = "stop"
  monitoring                           = false

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
    # The trusted API container uses the instance role for Cognito, SES, S3,
    # ECR, and Parameter Store. A hop limit of two preserves IMDSv2 while
    # allowing that containerized AWS SDK credential flow.
    http_put_response_hop_limit = 2
    instance_metadata_tags      = "enabled"
  }

  credit_specification {
    cpu_credits = "standard"
  }

  root_block_device {
    encrypted             = true
    volume_type           = "gp3"
    volume_size           = var.root_volume_size_gib
    delete_on_termination = true

    # Scope these tags to the root volume. The instance-level volume_tags
    # argument also manages separately attached volumes and causes drift with
    # the dedicated aws_ebs_volume resource below.
    tags = {
      Name        = "${var.resource_prefix}-root"
      Application = "refleja-tu-interior"
      Environment = "development"
      ManagedBy   = "terraform"
      BudgetScope = "rti-dev"
    }
  }

  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    data_volume_id = aws_ebs_volume.data.id
  })

  user_data_replace_on_change = false

  tags = {
    Name = "${var.resource_prefix}-application"
  }

  lifecycle {
    # The AWS provider reports tags from every attached EBS volume through
    # volume_tags. Root and data volumes are managed independently above, so
    # ignoring that aggregate view prevents the resources from fighting over
    # the data-volume Backup tag.
    ignore_changes = [ami, volume_tags, root_block_device[0].tags]
  }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.application.id
}

resource "aws_eip" "application" {
  domain = "vpc"

  tags = {
    Name = "${var.resource_prefix}-application"
  }
}

resource "aws_eip_association" "application" {
  allocation_id = aws_eip.application.id
  instance_id   = aws_instance.application.id
}

resource "aws_cloudwatch_metric_alarm" "automatic_recovery" {
  alarm_name          = "${var.resource_prefix}-automatic-recovery"
  alarm_description   = "Recover the DEV instance after consecutive system status failures."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "missing"

  dimensions = {
    InstanceId = aws_instance.application.id
  }

  alarm_actions = ["arn:${data.aws_partition.current.partition}:automate:${var.aws_region}:ec2:recover"]
}
