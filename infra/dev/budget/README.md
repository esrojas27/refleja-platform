# Guardrails de costo para DEV

Esta raíz de Terraform declara un presupuesto mensual de USD 20 para recursos
marcados con `BudgetScope=rti-dev` y alertas de costo real en USD 10, 15, 18 y 20.
No se aplica automáticamente: revisar el plan y la cuenta antes de crear el budget.

```powershell
Copy-Item terraform.tfvars.example terraform.tfvars
terraform init
terraform fmt -check
terraform validate
terraform plan -out dev-budget.tfplan
```

El filtro por etiqueta no cubre cargos que AWS no permita etiquetar. Antes del
primer despliegue se debe complementar con Cost Anomaly Detection y revisar el
total de la cuenta en Cost Explorer. Todos los recursos creados en las siguientes
fases deben conservar la etiqueta `BudgetScope=rti-dev`.
