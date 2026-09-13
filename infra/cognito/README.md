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

## Correo de invitaciones (RTI-VS1-010)

`ses_sender_email` es opcional. Al definirlo, Terraform crea la identidad de correo
de SES y AWS envía un enlace de verificación al propietario. Después de confirmar
ese enlace, cambia `enable_ses_delivery` a `true`, revisa un segundo plan y aplícalo
para configurar Cognito. La separación en dos pasos evita intentar utilizar una
identidad todavía no verificada. No se incluyen claves AWS ni contraseñas en Terraform.

Mantén `INVITATIONS_ENABLED=false` en `.env` hasta que la identidad esté verificada.
En el sandbox de SES, cada destinatario de prueba también debe estar verificado.
El alta de un usuario nuevo genera un correo de credenciales administrado por
Cognito y un correo transaccional de invitación enviado por la API; un usuario ya
confirmado recibe solamente el segundo. `SENT` significa que SES aceptó la solicitud,
no que el destinatario haya recibido o leído el correo.

### Activación segura en desarrollo

1. En `terraform.tfvars`, define `ses_sender_email` con una identidad de prueba que
   controles y conserva `enable_ses_delivery = false`.
2. Ejecuta `terraform plan` y aplica únicamente después de revisar que se crea la
   identidad de correo SES sin reemplazar el User Pool ni el app client.
3. Abre el mensaje de AWS enviado al remitente configurado y confirma la identidad.
4. Si la cuenta continúa en SES sandbox, crea y confirma también la identidad del
   correo que recibirá la invitación de prueba.
5. Cambia `enable_ses_delivery = true`, vuelve a revisar el plan y aplícalo. Este
   segundo paso configura Cognito para usar la identidad ya verificada.
6. Configura el `.env` raíz con `INVITATIONS_ENABLED=true`, región, User Pool,
   remitente verificado, URL web y `AWS_PROFILE=rti-dev`. Reinicia `dev.cmd`.

Antes de cada `apply`, confirma que el perfil AWS corresponde a la cuenta y región
de desarrollo. Nunca confirmes un plan que destruya o reemplace el User Pool,
app client o dominio existentes. Los archivos de plan, estado y variables locales
no se versionan.

### Desactivación

Para detener nuevas invitaciones sin alterar usuarios o datos ya creados, establece
`INVITATIONS_ENABLED=false` y reinicia la API. No es necesario destruir SES ni
Cognito. Una invitación ya persistida conserva su estado e historial.

### Evidencia y transición a un remitente corporativo

El recorrido de desarrollo se validó con una identidad personal controlada y un
destinatario diferente también verificado: Cognito entregó las credenciales, SES
aceptó la invitación y el colaborador completó login y aceptación. Esa identidad
personal es sólo evidencia de integración y no debe convertirse en remitente de un
ambiente compartido o productivo.

Antes de enviar a usuarios externos se debe usar un correo del dominio corporativo
de Refleja Tu Interior, verificar el dominio y su autenticación DNS, solicitar la
salida de SES sandbox y comprobar reputación y entregabilidad. Los mensajes de la
prueba inicial llegaron a spam, por lo que ese trabajo es requisito de preparación
operativa, pero no bloquea el cierre funcional local del 010.

El usuario invitado terminó `CONFIRMED` en Cognito, aunque `email_verified` no quedó
establecido. Debe acordarse si la verificación se realizará administrativamente,
durante la aceptación o mediante un flujo propio de Cognito antes de depender de
recuperación de contraseña por correo.
