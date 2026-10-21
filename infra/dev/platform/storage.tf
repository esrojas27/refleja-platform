data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

locals {
  backup_bucket_name = "${var.resource_prefix}-backups-${data.aws_caller_identity.current.account_id}"
}

resource "aws_ebs_volume" "data" {
  availability_zone = local.selected_availability_zone
  size              = var.data_volume_size_gib
  type              = "gp3"
  encrypted         = true

  tags = {
    Name   = "${var.resource_prefix}-data"
    Backup = "daily"
  }
}

resource "aws_s3_bucket" "backups" {
  bucket        = local.backup_bucket_name
  force_destroy = false
}

resource "aws_s3_bucket_ownership_controls" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire-postgres-copies"
    status = "Enabled"
    filter { prefix = "backups/postgres/" }
    expiration { days = 30 }
    # Versioned buckets first create a delete marker. Remove the retained data
    # version one day later, rather than paying for another 30 days of copies.
    noncurrent_version_expiration { noncurrent_days = 1 }
  }

  rule {
    id     = "remove-postgres-delete-markers"
    status = "Enabled"
    filter { prefix = "backups/postgres/" }
    expiration { expired_object_delete_marker = true }
  }

  rule {
    id     = "expire-old-backup-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.backup_noncurrent_retention_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.backups]
}

data "aws_iam_policy_document" "backup_bucket" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.backups.arn,
      "${aws_s3_bucket.backups.arn}/*"
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "backups" {
  bucket = aws_s3_bucket.backups.id
  policy = data.aws_iam_policy_document.backup_bucket.json
}
