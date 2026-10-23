# Entrega y revisión de actividades

## Alcance

El consultor define el contenido de la actividad sin seleccionar destinatarios.
La agenda individual de su sesión determina la asignación. El colaborador responde
con texto y el consultor aprueba la entrega o solicita cambios.

La actividad puede conservar un enlace HTTPS validado a un video de YouTube y lo
muestra al consultor y al colaborador como enlace externo seguro. No se incluyen
iframe, archivos, adjuntos, calificaciones, rúbricas, edición de la actividad,
notificaciones ni cálculo agregado de progreso.

## Estados

Cada `activity_assignment` tiene uno de estos estados persistidos por nombre:

- `ASSIGNED`: pendiente de respuesta.
- `SUBMITTED`: respuesta enviada y pendiente de revisión.
- `CHANGES_REQUESTED`: el consultor devolvió la entrega con un comentario; el
  colaborador puede corregirla y reenviarla.
- `COMPLETED`: entrega aprobada y finalizada.

Las únicas transiciones permitidas son `ASSIGNED → SUBMITTED`,
`CHANGES_REQUESTED → SUBMITTED` y `SUBMITTED → CHANGES_REQUESTED | COMPLETED`.
Las operaciones inválidas responden `409` y no modifican información.

## Asignación mediante agenda

Guardar la fecha de una sesión asigna sus actividades no archivadas al subgrupo
seleccionado. Crear o duplicar una actividad incorpora automáticamente a quienes
ya tienen fecha, incluidas inscripciones invitadas habilitadas; estas deben aceptar
la invitación antes de acceder. Los contratos de creación y duplicación ya no
reciben `assignToAll` ni `enrollmentIds`. El programa se bloquea para serializar las
operaciones y las asignaciones existentes nunca se duplican ni sobrescriben.
Véase `individual-session-schedules.md` para vencimientos y reprogramación.

## Persistencia y seguridad

La migración `V20260914030000__add_activity_submission_review.sql` agrega estado,
respuesta, fechas y revisión a `rti.activity_assignments`. Restricciones SQL
mantienen la coherencia de cada estado y limitan los textos. La tabla conserva RLS
por `app.current_organization_id`; los comandos usan bloqueo pesimista para evitar
transiciones concurrentes incompatibles.

La ruta personal deriva usuario, membresía, inscripción y organización del `sub`
de Cognito. El navegador no elige esos identificadores. La revisión exige un
`CONSULTANT` activo en la organización indicada y comprueba programa, actividad y
asignación dentro del tenant.

## API

- `POST /api/v1/me/programs/{programId}/activities/{activityId}/submission`
- `POST /api/v1/organizations/{organizationId}/programs/{programId}/activities/{activityId}/assignments/{assignmentId}/review`

La primera recibe `responseText`. La segunda recibe `decision` (`APPROVE` o
`REQUEST_CHANGES`) y `comment`; el comentario es obligatorio al solicitar cambios.

## Validación manual

1. Ingresar como consultor y abrir **Actividades** de un programa con dos
   colaboradores activos.
2. Crear una actividad y agendar la sesión para un subgrupo. Comprobar que solo
   esas personas reciben sus actividades, con vencimiento tres días después.
3. Crear otra actividad en esa sesión: debe asignarse al mismo subgrupo sin
   solicitar destinatarios. Guardar la misma fecha no debe duplicar asignaciones.
4. Ingresar como ese colaborador, abrir **Mis programas**, responder y pulsar
   **Completar actividad**. Debe quedar **En revisión**.
5. Volver como consultor, abrir **Actividades**, leer la respuesta y solicitar
   cambios con comentario.
6. Como colaborador, comprobar el comentario, corregir y reenviar.
7. Como consultor, aprobar. Como colaborador, verificar el estado **Completada** y
   que ya no pueda modificar la respuesta.
