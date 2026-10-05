# DEV Terraform state bootstrap

This root creates the private, versioned S3 bucket that stores the DEV platform state. It is deliberately separate because a Terraform stack must not manage the backend that contains its own state.

## One-time bootstrap

```powershell
Copy-Item terraform.tfvars.example terraform.tfvars
terraform init
terraform plan -out bootstrap-state.tfplan
terraform apply bootstrap-state.tfplan
terraform output -json backend_hcl
```

Copy the output values into `../platform/backend.hcl`. Do not commit `terraform.tfvars`, `backend.hcl`, state files, or saved plan files.

The bucket uses native S3 state locking through `use_lockfile = true`, versioning for recovery, server-side encryption, and a policy that denies unencrypted transport. The bootstrap state remains local; store an encrypted backup of it after the one-time apply.
