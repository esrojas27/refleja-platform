# Administración de participantes

Incremento del 2026-10-20, probado y aprobado por el usuario, publicado en
`ffc2415`. La corrección E2E `aa57b0a` pasó CI/contenedores y el despliegue DEV
`39541492017` terminó exitosamente. Este incremento de participantes no cambia
configuración Cognito/SES; la rotación del remitente fue una operación posterior.

## Decisiones aprobadas

- Colaborador, Líder y RRHH (`COMPANY_ADMIN`) siguen siendo roles de organización.
  Cambiarlos afecta sus otros programas en esa empresa y requiere advertencia,
  motivo y confirmación explícita. No afecta otras empresas.
- Se puede completar una participación con pendientes, tras advertirlo. Conserva
  acceso de solo consulta y progreso real: no aprueba entregas ni fuerza 100%.
- Suspender y retirar afectan exclusivamente la inscripción al programa, no la
  cuenta Cognito ni la membresía global. No borran respuestas ni entregas.

## Operaciones desde Personas del programa

Solo un consultor activo autorizado en esa organización puede administrarlas.

| Estado de inscripción | Operaciones |
| --- | --- |
| Invitada | Revocar invitación; renovar si expiró; cambiar rol; historial |
| Activa | Suspender; retirar; completar; cambiar rol; historial |
| Suspendida | Reincorporar; retirar; cambiar rol; historial |
| Completada | Reincorporar; suspender; retirar; cambiar rol; historial |
| Retirada | Reincorporar; cambiar rol; historial |

Completar requiere un programa activo o finalizado que haya sido activado.
Reincorporar y cambiar roles requieren un programa editable (no cerrado).
**Excepción deliberada al cierre del programa:** revocar, suspender y retirar
siguen disponibles para restringir accesos; no reabren contenido ni ejecución.
Una inscripción antigua `PENDING_APPROVAL` no obtiene una aprobación nueva por
esta pantalla: conserva solo cambio de rol e historial.

Las cuentas o membresías globales deshabilitadas no se reactivan mediante estas
operaciones. Se puede restringir su inscripción, pero no reincorporarlas ni
cambiarles roles. Los inscritos con rol `CONSULTANT` o `SUPER_ADMIN` tienen su
acceso administrativo protegido y no se administran desde una inscripción.

## Reincorporación e invitaciones

- Si ya aceptó, se restaura la inscripción activa y se conserva todo el trabajo.
  Suspender una participación completada y reincorporarla restaura `COMPLETED`,
  no `ACTIVE`; reincorporarla de nuevo expresamente permite retomar entregas.
- Si nunca aceptó una invitación revocada/expirada, se prepara otra invitación
  **Sin enviar**. Sus siete días comienzan al pulsar **Enviar Invitaciones**.
  La inscripción queda `INVITED` hasta su nueva aceptación. No se
  provisiona otra cuenta ni se modifica la validez del enlace viejo.
- Las invitaciones antiguas siguen siendo consultables con su programa, pero no
  pueden activar una inscripción que ya cambió de invitación, fue retirada,
  suspendida o completada. Repetir una aceptación no reabre accesos.
- El envío externo solo ocurre mediante una acción explícita posterior al registro.
  Si no se confirma, se conserva la invitación y se puede reintentar al actualizar. No hay
  reenvíos automáticos ante un resultado incierto. Un correo enviado no puede
  retirarse del buzón: se invalida su enlace, no el correo.
- Reincorporar no asigna automáticamente actividades que se hayan creado mientras
  la persona estaba fuera. Mantiene las asignaciones anteriores.

El cambio de rol reemplaza únicamente Colaborador, Líder y RRHH por el elegido;
no concede ni elimina roles administrativos. Actualiza todas las invitaciones
no aceptadas de esa membresía, incluso las expiradas/revocadas, para evitar
reconceder un rol antiguo al aceptar o renovar. Las aceptadas son históricas.

## Acceso e historial

Las consultas y escrituras verifican la inscripción en el backend. Suspendidos y
retirados no aparecen en Mis programas ni acceden a sus actividades por URL
directa. Líder/RRHH tampoco mantienen los metadatos del programa bloqueado por
la ruta genérica de programas. Otras inscripciones permanecen disponibles.
Completados conservan consulta, pero no envían actividades, encuestas ni editan
DISC como líderes. El consultor conserva las respuestas para análisis y revisión.

La migración aditiva `V20261020010000` agrega `SUSPENDED`, su estado de origen y
`enrollment_changes`. No altera el estado de inscripciones existentes. El usuario
runtime solo puede INSERT/SELECT en el historial, con RLS por organización y FK
compuestas para programa, inscripción, membresía e invitaciones.

Se registran nuevas invitaciones, primeras aceptaciones y acciones de administración
con actor, nombre/correo de referencia, fecha, motivo, estado/roles anteriores y
nuevos, invitaciones, versión y requestId. No se inventan eventos históricos de
antes de este incremento. El historial de una inscripción incluye los cambios de
rol de su membresía originados en otros programas de la misma organización,
identificados como tales. Paginación fija por fecha/id descendentes.

Las transacciones bloquean y refrescan programa e inscripción antes de modificar;
las entregas/encuestas toman los mismos bloqueos antes de comprobar el acceso.
Los cambios de rol serializan con creación/aceptación de invitaciones mediante
la fila del usuario y la membresía. La versión de inscripción y, para roles,
la versión de membresía evitan aplicar formularios obsoletos. Esto no recupera
datos ya descargados por el navegador ni revierte operaciones confirmadas antes
de la restricción. No se cierra la sesión Cognito global de la persona.

## Contrato

Base: `/api/v1/organizations/{org}/programs/{program}/enrollments/{enrollment}`.

- `POST /administration`: `{version, action, reason, confirmed}`. Acciones:
  `REVOKE`, `WITHDRAW`, `SUSPEND`, `COMPLETE`, `REINSTATE`, `CHANGE_ROLE`.
  Esta última exige además `role` y `roleVersion`. Motivo obligatorio, máximo
  1000 caracteres; confirmación debe ser `true`. Respuesta: inscripción con su
  versión, estado de origen de suspensión y acceso actual de la membresía.
- `GET /history?page=0&size=20`: lista paginada (máximo 100), autorizada igual que
  las acciones. Ambas respuestas son `no-store`, con `X-Request-ID`.
- `GET /me/programs` y detalle agregan `enrollmentStatus` para diferenciar programa
  activo de participación completada y no ofrecer entregas ni tareas accionables.

## Validación manual

1. Reiniciar `dev.cmd` para aplicar la migración. Consultor → organización →
   programa → Personas del programa: comprobar estados, roles y botones por fila.
2. Crear una invitación y revocarla con motivo/confirmación. Su enlace no debe
   aceptarse. Reincorporar: otro enlace, siete días y nueva aceptación obligatoria.
3. Con dos sesiones, suspender a un colaborador activo y recargar su programa/
   actividades. Debe perder acceso incluso con la misma sesión y URL directa.
   Reincorporar y comprobar conservación de entrega, encuesta y progreso.
4. Retirar a alguien y comprobar el mismo bloqueo, sin afectar otro programa.
5. Completar con entrega al 50% y encuesta pendiente. El colaborador conserva
   ese 50%, sin formulario de entrega/encuesta, próxima actividad ni contador de
   pendientes accionables. Reincorporar permite continuar sin perder su respuesta.
6. Suspender una participación completada y reincorporar: sigue en solo consulta.
7. Cambiar Colaborador → Líder/RRHH: leer el aviso de organización, confirmar y
   comprobar otro programa. El perfil no se reinicia; los permisos cambian según
   el rol. No se pueden conceder Consultor o Administrador desde este formulario.
8. Abrir Historial: motivo, actor, fecha, estados/roles y origen en otro programa.
   Dos pestañas: cambiar en una, intentar usar la otra y comprobar conflicto de
   versión, sin segundo cambio silencioso.
9. Finalizar un programa: aún permite retirar/suspender/revocar, pero no
   reincorporar ni cambiar roles. Recorrer también móvil y teclado.

La verificación automatizada usa PostgreSQL 18 desechable y proveedores Cognito/SES
simulados; no envía correos reales ni modifica la base de desarrollo. La validación
visual fue aprobada por el usuario. Después de publicar, el journey automatizado
real con Cognito y los gates remotos pasaron en el run `39541089622`, tras corregir
la aserción del estado traducido de inscripción (`aa57b0a`).

Durante la validación se identificó una sesión SSO local expirada del perfil
`rti-dev`, anterior al registro y al envío. Su renovación se realiza mediante
`aws sso login --profile rti-dev`. El remitente del `.env` local se actualizó a
`marcayconexion@paularojas.com.co`, verificado en SES según confirmación del usuario;
el cambio fue probado y aprobado. Ese archivo sigue ignorado y no se publica en
Git. No se cambió el remitente de la infraestructura desplegada en esta iteración.

## Evidencia local

- `mvn.cmd -o verify`, con límites temporales de memoria: **280 pruebas**, sin
  fallos, errores ni omisiones; migración y modelo JPA verificados y empaquetado
  correcto. Incluye revocación/renovación, enlaces antiguos, permisos con el mismo
  JWT, progreso conservado al 50/100%, estados de origen de suspensión, cambio
  organizacional de roles, aislamiento RLS e historial sin UPDATE/DELETE runtime.
- `npm.cmd test -- --maxWorkers=1`: **211 pruebas en 34 archivos**, correctas.
- TypeScript `--noEmit --incremental false`, ESLint y `git diff --check`: correctos.
- Playwright `--list`: descubre 17 pruebas, incluido el journey real. Solo se
  comprobó el descubrimiento; no se inició Next ni se ejecutó navegador/Cognito.
- Sin modificaciones de configuración AWS, workflows de despliegue ni scripts.
