# RTI-VS1-010 — Enroll and Invite Collaborator

Estado: **cerrado para desarrollo local**. La verificación automática y el recorrido
manual completo contra Cognito y Amazon SES reales fueron correctos. El cierre está
publicado en el commit `bbf8d98`.

Se revisaron Product Definition, ADR-001 a ADR-005 y el ticket 010 del
[documento canónico](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit?tab=t.s1fvvog8kpix).

## Contrato y permisos

| Operación | Ruta | Actor y resultado |
| --- | --- | --- |
| POST | `/api/v1/organizations/{organizationId}/programs/{programId}/enrollments` | CONSULTANT activo: 201 con inscripción, participante e invitación |
| GET | misma colección | CONSULTANT activo: página tenant/program-scoped |
| POST | `.../enrollments/{enrollmentId}/invitation-delivery` | CONSULTANT activo: reintento explícito sin duplicar |
| GET | `/api/v1/invitations` | Identidad Cognito interna: sólo sus invitaciones |
| POST | `/api/v1/invitations/{invitationId}/accept` | Identidad invitada: acepta una invitación propia y vigente |

El tenant y el programa siempre se revalidan en backend. El navegador no decide
organización efectiva, rol, estados, IDs ni vencimiento. Los recursos ajenos o no
disponibles se ocultan con 404; ausencia o invalidez del token responde 401 y falta
de permiso interno responde 403.

## Estados y reglas aprobadas

- Usuario nuevo: `INVITED`; membresía: `PENDING`; inscripción: `INVITED`.
- La invitación vence siete días después de crearse. El backend aplica el
  vencimiento aunque el cliente conserve una pantalla antigua.
- Al aceptar con el mismo `sub` de Cognito: usuario, membresía e inscripción pasan
  a `ACTIVE` en una operación transaccional.
- Un usuario o acceso existente `ACTIVE` se conserva. Estados suspendidos,
  revocados o incompatibles nunca se restauran implícitamente.
- La restricción única organización/programa/participante impide duplicados.
- Reintentar entrega no crea otra inscripción ni renueva el vencimiento.

## Identidad, correo y persistencia

La API usa Cognito Admin APIs para resolver por correo o crear el usuario con
mensajería administrada por Cognito y obtiene el `sub` real. No genera, recibe ni
persiste contraseñas. La invitación de negocio se envía con Amazon SESv2.

La migración `V20260909010000__collaborator_invitations.sql` crea
`rti.user_invitations`, restricciones e índices, y agrega la referencia opcional
desde `enrollments`. Se guardan el usuario invitado, programa, organización,
estados, vencimiento y metadatos mínimos de entrega. No se guardan tokens de
aceptación, códigos OAuth ni credenciales. El rol runtime no puede borrar
invitaciones.

La entrega ocurre después de confirmar los datos internos. Fallar Cognito antes de
la creación no deja inscripción; fallar SES conserva la inscripción y marca la
entrega para revisión/reintento. `SENT` sólo significa que el proveedor aceptó la
solicitud. Un timeout externo puede producir un correo repetido al reintentar, pero
no una inscripción duplicada.

El alta de un usuario nuevo puede enviar dos mensajes: credenciales administradas
por Cognito y la invitación transaccional de SES. Un usuario Cognito ya confirmado
recibe únicamente la invitación de SES.

La invitación transaccional para colaboradores usa el asunto `Bienvenido(a) a tu
espacio en Refleja Tu Interior`, personaliza el saludo con su nombre y comunica la
fecha real de vencimiento. Se entrega en texto plano y HTML con el llamado a la
acción `CREAR MI USUARIO`, que conduce a `/invitations`; el enlace no contiene
tokens, códigos ni credenciales. Las invitaciones de Líder y RRHH conservan su
mensaje de acceso según el rol, pues no requieren completar el perfil de
colaborador. Si `/invitations` se abre sin sesión, redirige al acceso de Cognito y
conserva únicamente el retorno seguro a esa ruta; después del primer acceso vuelve
automáticamente a las invitaciones, incluso cuando `/me` todavía responde 403 por
no existir una membresía activa. Al ingresar, un perfil pendiente muestra
`Completa tu perfil para comenzar` hasta que el colaborador guarde todos sus datos
obligatorios.

La validación real detectó que, en un User Pool configurado con `email` como
`UsernameAttributes`, Cognito devuelve un username interno generado, pero
`AdminCreateUser` con `RESEND` debe reutilizar el correo como identificador e incluir
el atributo `email` cuando solicita `DesiredDeliveryMediums=EMAIL`. La implementación
fue corregida y registra fallos del proveedor mediante operación, servicio, estado,
código y request ID, sin registrar correo, credenciales ni contenido del mensaje.

## Interfaz mínima

- El detalle del programa enlaza a la ruta responsive de colaboradores.
- El consultor puede registrar, listar y reintentar la entrega cuando corresponde.
- `/invitations` lista y permite aceptar exclusivamente invitaciones propias.
- `/account` enlaza a invitaciones incluso si `/me` todavía responde 403 para un
  usuario invitado, porque la identidad Cognito existe antes de activar membresía.
- No se implementó la vista “Mis programas” del 011, dashboards ni datos ficticios.

## Verificación automática

- Backend: **153 pruebas**, 0 fallos y 0 omisiones; **39** cubren específicamente
  inscripción/invitación con JWT firmado, PostgreSQL 18 real en Testcontainers y
  frontera Cognito/SES mockeada. Una prueba unitaria adicional verifica el contrato
  de `RESEND` exigido por Cognito para pools cuyo username es el correo.
- Frontend: **76 pruebas** en 10 archivos, lint y build de producción correctos.
- Playwright: **9 pruebas** en Chromium, incluida navegación responsive sin sesión
  a colaboradores e invitaciones; ejecución estable con `--workers=1`.
- Lanzador local: **6 pruebas**, incluida coherencia de variables de invitación.
- Terraform: `fmt -check -recursive` y `validate` correctos. La configuración SES de
  desarrollo se aplicó en dos fases después de revisar que no reemplazara el User
  Pool, el app client ni el dominio.

Los escenarios automáticos incluyen roles, tenant cruzado, validación de entrada,
paginación, duplicados, estados suspendidos/revocados, vencimiento, identidad
equivocada, aceptación, fallo de entrega y reintento sin extender la vigencia.

## Validación manual completada

1. Se verificaron en SES `us-east-1` una identidad remitente y un destinatario de
   prueba distintos. La cuenta continúa en sandbox.
2. Cognito quedó configurado con `EmailSendingAccount=DEVELOPER` y el remitente SES
   verificado, sin reemplazar los recursos de autenticación existentes.
3. Un consultor creó la inscripción; la API persistió usuario `INVITED`, membresía
   `PENDING`, enrollment `INVITED` e invitación `PENDING` con vigencia de siete días.
4. Después de corregir el contrato `RESEND`, el destinatario recibió el correo de
   credenciales de Cognito y la invitación transaccional. La entrega quedó `SENT`.
5. El destinatario completó la contraseña administrada por Cognito, inició sesión,
   vio exclusivamente su invitación y la aceptó.
6. Cognito quedó `CONFIRMED`; PostgreSQL quedó con usuario, membresía y enrollment
   `ACTIVE`, invitación `ACCEPTED` y entrega `SENT`.
7. `/api/v1/me` respondió 200, mostró la organización activa y únicamente el rol
   `COLLABORATOR`. No se capturaron tokens, contraseñas, códigos OAuth ni enlaces de
   un solo uso como evidencia.

## Limitaciones y criterio de cierre

No se desplegaron web, API o PostgreSQL en AWS y no se solicitó salida de SES
sandbox. La identidad personal usada para esta prueba no es el remitente definitivo;
antes de un uso externo se requiere un dominio corporativo verificado, autenticación
DNS y una revisión de entregabilidad, pues los mensajes de prueba llegaron
inicialmente a spam. El usuario Cognito terminó `CONFIRMED`, pero `email_verified`
no quedó establecido; la política para verificar ese atributo debe acordarse antes
de depender de recuperación de contraseña por correo.

Un usuario nuevo creado en Cognito antes de un conflicto interno podría quedar sin
inscripción; una repetición reutiliza el mismo `sub` y no debe borrarlo
automáticamente. RLS pertenece al 012 y CI/E2E completo al 013; los controles de
tenant y autorización del 010 ya se aplican en backend y base de datos.

El recorrido y los criterios del 010 están aceptados para desarrollo local y su
incremento se publicó antes de iniciar RTI-VS1-011.
