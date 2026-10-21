# Correo DEV: remitente corporativo y salida de SES sandbox

Checkpoint del 2026-10-20, aplicado con autorización del usuario en la cuenta
`836528258662`, región `us-east-1`. No se publicó código nuevo de la aplicación.
El usuario autorizó después el commit y push de estos ajustes de infraestructura
y documentación. El push publica también el incremento de participantes pendiente;
CI y despliegue deben verificarse separadamente de la rotación ya aplicada.

## Estado confirmado en AWS

- Remitente verificado: `marcayconexion@paularojas.com.co`,
  `VerifiedForSendingStatus=true`, `VerificationStatus=SUCCESS`.
- `SES ProductionAccessEnabled=true`, `SendingEnabled=true`.
- Revisión de acceso: `GRANTED`, caso `179255322000222`. La solicitud pasó de
  `PENDING` a aprobada durante esta operación. No requiere una nueva solicitud.
- Los destinatarios ya no necesitan una identidad verificada individual en SES
  para envíos desde esta región. El remitente sí debe mantenerse verificado.
- Cuota informada por AWS al cierre: 50.000 mensajes/24 h y 14 mensajes/s.
  Es una capacidad máxima concedida, no volumen previsto ni presupuesto de gasto.

La solicitud es para correo transaccional: invitaciones individuales de un piloto
de programas, iniciadas por un consultor autenticado, sin campañas promocionales
ni listas compradas. El usuario confirmó consentimiento de destinatarios y que
el equipo atenderá rebotes/quejas en el correo corporativo. SES tiene supresión
por `BOUNCE` y `COMPLAINT`, y reenvío de notificaciones activado para la identidad.
El seguimiento del buzón es un procedimiento humano; no se agregó un procesador
automático de eventos ni notificaciones nuevas.

## Rotación aplicada

Hay dos correos independientes y ambos deben utilizar el remitente nuevo:

1. **API / invitación al programa:** Parameter Store
   `/refleja-tu-interior/dev/INVITATIONS_SES_FROM`, versión 2, y permiso IAM del
   rol `rti-dev-application` actualizado para la identidad corporativa.
2. **Cognito / acceso inicial:** `email_configuration` del pool
   `us-east-1_AKiEfWZMK`, con `From` y `SourceArn` de la identidad corporativa.

El plan de plataforma aplicó 2 cambios in-place; el de Cognito, 1 cambio in-place.
Ninguno creó, destruyó ni reemplazó recursos. Se conservaron usuarios, app client,
dominio, callbacks locales y HTTPS, y la identidad personal anterior para rollback.
Los planes posteriores de ambas raíces mostraron `No changes`.

La API ya desplegada se recargó mediante SSM con respaldo del archivo runtime y
rollback condicionado a salud. Se cambió únicamente el valor de remitente y se
recreó solo `api`, sin build ni pull de imágenes. La imagen se comprobó idéntica
antes/después y la API quedó `healthy` con el remitente nuevo. La release siguió
siendo `549642d6ae288a9610ec8d9f512c734b48adfffe`; el commit local de participantes
`ffc2415` no se desplegó con esta operación.

Auditoría SSM:

- Inspección previa: `242e9c13-518f-4e1b-8839-1a0dd5dee154`.
- Rotación y salud: `966fb84c-cf4d-4aed-a7c6-97749c6b7616`, `Success`.

La instancia estaba detenida por horario. Se encendió temporalmente para aplicar
y comprobar la configuración, y se devolvió a detenida al terminar. Se conserva
el horario lunes–viernes 08:00–20:00, `America/Bogota`.

## Configuración y rollback

El `.env` local usa también el remitente corporativo. `.env`, `terraform.tfvars`,
estado y planes siguen ignorados por Git. No se escribieron credenciales ni
contraseñas en archivos versionados ni en salidas de la operación.

Para plataforma: mantener ambas identidades en `ses_identity_arns` y seleccionar
la corporativa mediante `invitation_sender_email`.

Para Cognito: se conserva el `ses_sender_email` administrado anterior y se define
`ses_delivery_sender_email` con la identidad externa ya verificada. Esto evita
reemplazar o borrar la identidad original; una postcondición bloquea la rotación
si la nueva no está verificada. La opción es retrocompatible.

Para revertir, revisar/aplicar un plan que restaure `invitation_sender_email`,
dejar `ses_delivery_sender_email=null`, y recargar el runtime de la API desde
Parameter Store. Un cambio aislado en Parameter Store no actualiza por sí solo
un contenedor que ya está ejecutándose.

Verificación local de infraestructura: `terraform fmt -check`,
`terraform validate`, planes reales sin diferencias y 4 pruebas `terraform test`
con proveedor AWS simulado (sin llamadas reales): comportamiento anterior,
rotación conservando identidad anterior, rechazo de identidad sin verificar y
compatibilidad con SES deshabilitado.

## Pendiente antes de ampliar el piloto

La verificación de la dirección es correcta, pero SES reporta
`DkimAttributes.Status=FAILED` para el remitente corporativo. Falta coordinar con
el responsable DNS de `paularojas.com.co` la autenticación DKIM y revisar DMARC.
No se agregaron ni cambiaron registros DNS durante esta operación. Estar fuera
del sandbox no garantiza que Gmail u otros proveedores entreguen en inbox.

No se enviaron correos de prueba, no se crearon usuarios/inscripciones de prueba
y no se ejecutó el journey real con Cognito. La primera prueba funcional debe
invitar deliberadamente a una persona que haya aceptado recibir el mensaje y
comprobar bienvenida, invitación, spam y aceptación; `SENT` solo confirma que SES
aceptó el envío, no que el mensaje llegó o fue leído.

Consulta de estado sin enviar mensajes:

```powershell
aws sesv2 get-account --profile rti-dev --region us-east-1 --query '{Enabled:ProductionAccessEnabled,Review:Details.ReviewDetails}'
aws sesv2 get-email-identity --email-identity marcayconexion@paularojas.com.co --profile rti-dev --region us-east-1 --query '{Verified:VerifiedForSendingStatus,DKIM:DkimAttributes.Status}'
```

Referencia: [solicitud de acceso de producción SES](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).
