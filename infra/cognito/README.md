# Cognito de desarrollo

Terraform es la fuente de verdad para el User Pool, el app client público y el
dominio administrado de Cognito de RTI-VS1-006. Esta configuración no crea usuarios,
grupos, Identity Pools ni secretos de cliente.

## Prerrequisitos

- Terraform compatible con la restricción de `versions.tf`.
- Credenciales AWS explícitas para la cuenta de desarrollo.
- Una región y un prefijo de dominio confirmados por el responsable del entorno.

## Validar y aplicar

```powershell
Copy-Item terraform.tfvars.example terraform.tfvars
terraform init
terraform fmt -check -recursive
terraform validate
terraform plan -out rti-vs1-006.tfplan
terraform apply rti-vs1-006.tfplan
terraform output
```

`terraform.tfvars`, los planes y el estado local están ignorados por Git. El lock
file de proveedores sí debe conservarse en el repositorio.

Después de aplicar, un administrador puede crear manualmente un usuario de prueba
en el User Pool desde la consola AWS. El User Pool bloquea el registro público y
Cognito administra cualquier credencial; no deben almacenarse
contraseñas en el repositorio ni en PostgreSQL.

Mapea las salidas a la API y al frontend como se describe en el README raíz. La
URL callback configurada por defecto es `/account`; esa ruta sólo representa la
estructura de UX. Spring Security sigue siendo la frontera de autenticación.
