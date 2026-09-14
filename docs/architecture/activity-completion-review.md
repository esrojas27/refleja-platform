# Entrega y revisión de actividades

## Alcance

Este incremento completa el primer ciclo operativo de una actividad. Al crearla,
el consultor puede asignarla a todos los colaboradores activos del programa o
desmarcar esa opción y elegir destinatarios individuales. El colaborador responde
con texto y el consultor aprueba la entrega o solicita cambios.

No se incluyen archivos, adjuntos, calificaciones, rúbricas, edición de la
actividad, notificaciones ni cálculo agregado de progreso.

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

## Asignación masiva

`assignToAll=true` no envía identificadores de inscripción. El backend resuelve
todas las inscripciones `ACTIVE` del programa dentro del contexto tenant y crea la
actividad y sus asignaciones en una sola transacción. Con `assignToAll=false`, la
lista explícita debe ser no vacía, no contener duplicados y pertenecer por completo
al mismo programa y organización.

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
2. Crear una actividad dejando marcada la asignación a todos y comprobar ambos
   destinatarios.
3. Crear otra desmarcando la opción, elegir sólo uno y comprobar el destinatario.
4. Ingresar como ese colaborador, abrir **Mis programas**, responder y pulsar
   **Completar actividad**. Debe quedar **En revisión**.
5. Volver como consultor, abrir **Actividades**, leer la respuesta y solicitar
   cambios con comentario.
6. Como colaborador, comprobar el comentario, corregir y reenviar.
7. Como consultor, aprobar. Como colaborador, verificar el estado **Completada** y
   que ya no pueda modificar la respuesta.
