data "aws_iam_policy_document" "github_deploy_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.github_oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["${var.github_repository_subject_prefix}:environment:${var.github_deployment_environment}"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${var.resource_prefix}-github-deploy"
  description        = "Short-lived GitHub OIDC role for the protected DEV deployment workflow."
  assume_role_policy = data.aws_iam_policy_document.github_deploy_assume_role.json
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "AuthorizeEcr"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "PushApplicationImages"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart"
    ]
    resources = [for repository in aws_ecr_repository.application : repository.arn]
  }

  statement {
    sid       = "UploadDeploymentBundle"
    effect    = "Allow"
    actions   = ["s3:DeleteObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.backups.arn}/deployments/*"]
  }

  statement {
    sid       = "StartDevInstance"
    effect    = "Allow"
    actions   = ["ec2:StartInstances"]
    resources = [aws_instance.application.arn]
  }

  statement {
    sid    = "InspectDevInstance"
    effect = "Allow"
    actions = [
      "ec2:DescribeInstanceStatus",
      "ec2:DescribeInstances"
    ]
    resources = ["*"]
  }

  statement {
    sid     = "RunDeploymentCommand"
    effect  = "Allow"
    actions = ["ssm:SendCommand"]
    resources = [
      aws_instance.application.arn,
      "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}::document/AWS-RunShellScript"
    ]
  }

  statement {
    sid    = "ReadDeploymentCommandResult"
    effect = "Allow"
    actions = [
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
      "ssm:DescribeInstanceInformation"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "${var.resource_prefix}-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
