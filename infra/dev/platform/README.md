# Refleja Tu Interior DEV platform

This Terraform root provisions the smallest practical AWS foundation for product validation while keeping the monthly DEV target below USD 20 under the documented usage assumptions.

## Included

- one public subnet in a dedicated VPC; no NAT Gateway and no load balancer;
- one scheduled ARM64 `t4g.small` EC2 instance with IMDSv2, no SSH, and SSM access;
- encrypted gp3 root and persistent data volumes;
- a fixed Elastic IP and optional Route 53 record;
- immutable ECR repositories for the API and web images;
- a private, encrypted, versioned S3 backup bucket;
- least-privilege runtime access to ECR, backups, Parameter Store, Cognito, and SES;
- weekday start/stop schedules and EC2 automatic system recovery.

Terraform creates infrastructure only. It does not deploy the application, create secret values, or restore a database. Those operations belong to the protected deployment phase.

## Prerequisites

1. Apply `../bootstrap-state` once and copy its output to `backend.hcl`.
2. Copy `terraform.tfvars.example` to `terraform.tfvars` and review the existing Cognito pool, authorized SES identities, and active sender email.
3. Authenticate with the `rti-dev` AWS SSO profile.

## Safe execution

```powershell
$env:AWS_PROFILE = "rti-dev"
terraform init -backend-config=backend.hcl
terraform fmt -check -recursive
terraform validate
terraform plan -out dev-platform.tfplan
terraform show dev-platform.tfplan
```

Only run `terraform apply dev-platform.tfplan` after the plan has been reviewed. DEV intentionally remains replaceable; PostgreSQL data is isolated on the persistent EBS volume and must also be protected by the S3 backup process.

## Operational notes

- Use the `session_manager_command` output for administration. Port 22 is never exposed.
- The data EBS volume is mounted at `/srv/refleja`; Docker data, PostgreSQL volumes, and deployment files persist there.
- Store secret runtime values under `/refleja-tu-interior/dev` as SecureString parameters. Never place secret values in Terraform variables or state. The non-secret invitation sender is managed as a regular String parameter by this stack.
- The S3 backup bucket is prepared here; the scheduled PostgreSQL dump and restore drill are added with deployment automation.
- The Elastic IP is billed while allocated, including when the instance is stopped. It is retained to keep DNS stable without an ALB.

## Rotate the invitation sender

The application reads `INVITATIONS_SES_FROM` from the Parameter Store key exposed by `invitation_sender_parameter`. No application code change is needed.

1. Verify the corporate email or, preferably, its domain in SES. Domain verification makes later mailbox changes easier.
2. Add the new identity ARN to `ses_identity_arns` while retaining the current ARN.
3. Set `invitation_sender_email` to the new corporate address and review/apply the Terraform plan.
4. Redeploy or restart the API so its environment is rebuilt from Parameter Store, then send a test invitation.
5. After validation, remove the old personal identity ARN in a later Terraform change.

Keeping both ARNs during the transition provides rollback: changing `invitation_sender_email` back and restarting the API restores the previous sender.
