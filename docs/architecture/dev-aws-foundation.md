# DEV AWS foundation

## Goal

Provide a secure and recoverable AWS environment for product validation without turning DEV into a production-scale platform. The target remains at or below USD 20 per month under normal scheduled use.

## Topology

```text
Internet
   |
Route 53 (optional) / Elastic IP
   |
Security group: 80, 443 only
   |
EC2 t4g.small (Amazon Linux 2023 ARM64)
   |-- Caddy
   |-- Next.js web container
   |-- Spring Boot API container
   `-- PostgreSQL container
          |
          `-- encrypted persistent gp3 data volume

Supporting services:
  ECR (web + API images)
  S3 (encrypted/versioned database backups)
  SSM Session Manager + Parameter Store
  Cognito + SES (existing integrations)
  EventBridge Scheduler (weekday start/stop)
  CloudWatch alarm (automatic EC2 recovery)
```

## Security boundaries

- No SSH, NAT Gateway, ALB, or public database port.
- Only Caddy receives internet traffic on ports 80 and 443.
- Administrative access uses SSM and the instance profile; no long-lived AWS keys live on the server.
- IMDSv2 is mandatory. Its hop limit is two because the trusted API container uses the instance role for AWS integrations; untrusted workloads must never run on this host.
- EBS, ECR, state, and backups are encrypted. State and backups are versioned and deny insecure transport.
- Runtime secrets are written separately as SSM SecureString parameters so Terraform state never contains secret values.
- Cognito and SES permissions are scoped to the existing user pool and the explicit set of verified sending identities.
- The active invitation sender is a non-secret Parameter Store value. Sender migration temporarily authorizes both identities, so switching to the corporate mailbox requires configuration and an API restart, not a code change.

## Availability and recovery

DEV intentionally uses one Availability Zone and one EC2 instance. This is not zero-downtime architecture; it is recoverable architecture appropriate to the budget:

- CloudWatch initiates EC2 recovery after consecutive system-status failures.
- The persistent data volume is independent from the replaceable root volume.
- Database dumps are destined for versioned S3 storage.
- Immutable ECR tags keep a bounded rollback history.
- Terraform state is stored in a separate versioned bucket with native S3 locking.

The deployment phase must add automated `pg_dump`, retention verification, and a documented restore drill before DEV is considered operationally complete.

## Temporary public endpoint

DEV initially uses `rti-dev.18-210-172-252.nip.io`, which resolves to the
reserved Elastic IP. Caddy requests and renews an individual public TLS
certificate for that hostname. The hostname is temporary and must not be used
for production. Replacing it with the corporate domain requires updating the
GitHub `development` variables and Cognito callback/logout URLs; application
code does not change.

The Cognito app client retains localhost URLs alongside the temporary HTTPS
URLs so local development remains available.

## Continuous delivery

The `Deploy development` workflow starts only after the existing `VS1 CI Gate`
succeeds for a push to `master`, or by an explicit manual dispatch from
`master`. It uses a dedicated GitHub OIDC role restricted to the `development`
environment and can only:

- push immutable images to the two DEV ECR repositories;
- upload and delete its own deployment bundle prefix;
- start and inspect the single DEV instance; and
- run and inspect the SSM deployment command on that instance.

The server pulls secrets directly from Parameter Store, so database passwords
never enter GitHub, the deployment bundle, Terraform state, or workflow logs.
The rollout retains the previous release and restores it if the new containers
do not become healthy.

## Cost controls

- Graviton instance and ARM64 images reduce compute cost.
- Weekday 08:00-20:00 scheduling in `America/Bogota` avoids idle compute hours.
- A single public subnet avoids NAT Gateway charges.
- No ALB is used; Caddy terminates TLS directly.
- ECR and backup retention are bounded.
- The existing AWS Budget configuration watches resources tagged with `BudgetScope=rti-dev`.

The `BudgetScope` cost-allocation tag must be active in the AWS Billing console before the tag-filtered budget can report these charges reliably.

The Elastic IP and EBS volumes continue to incur charges while EC2 is stopped. Actual AWS Cost Explorer data must be reviewed after the first seven days and the schedule or disk sizes adjusted if the monthly projection approaches the budget threshold.

## Delivery phases

1. Completed: create the remote state bucket.
2. Completed: review and apply the platform Terraform plan manually.
3. Completed: store runtime secrets under the reserved Parameter Store path.
4. Prepared: protected GitHub build, ECR push, SSM rollout, health checks, and rollback. It becomes active when these repository changes reach `master`.
5. Pending: add automated database backups and execute the first restore drill.

Every change to either Terraform root is formatted and validated by the `DEV infrastructure gate`. This gate never receives AWS credentials and cannot apply infrastructure.
