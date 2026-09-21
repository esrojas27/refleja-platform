# Actividades asignadas del programa

## Propósito

Este incremento convierte la estructura **Programa → Dimensión → Sesión** en un
recorrido utilizable: un consultor puede preparar actividades como contenido del
programa antes de incorporar participantes y asignarlas cuando existan
colaboradores activos. Cada colaborador ve exclusivamente sus propias actividades
asignadas desde el programa.

El incremento continúa fuera de VS1 y no modifica sus criterios de cierre.

## Contrato funcional mínimo

- La actividad exige sesión, título, instrucciones, fecha límite y posición; puede
  guardar un enlace HTTPS opcional a un video de YouTube.
- Puede crearse sin inscripciones activas; en ese caso persiste como definición de
  contenido con cero asignaciones y no es visible para colaboradores.
- Cuando se solicitan destinatarios, deben ser inscripciones `ACTIVE` del mismo
  programa. La creación de actividad y sus asignaciones es una única transacción.
- La asignación hace la actividad visible inmediatamente; todavía no existe un
  ciclo separado de borrador o publicación.
- El consultor puede listar actividades y sus destinatarios dentro del programa.
- El colaborador accede mediante su `sub` de Cognito y sólo recibe actividades
  vinculadas a su propia inscripción activa o completada.

El enlace se muestra como navegación externa segura. La reproducción embebida se
reserva para una iteración posterior. La entrega textual y la revisión se agregan en
[entrega y revisión de actividades](activity-completion-review.md). Continúan fuera
de alcance la edición, eliminación, reasignación, archivos, evaluaciones y el
cálculo agregado de progreso.

## Propiedad modular y persistencia

La migración `V20260914010000__create_program_activities.sql` agrega:

- `rti.program_activities`, propiedad del módulo `program` y vinculada mediante
  claves compuestas a una sesión del mismo tenant y programa;
- `rti.activity_assignments`, propiedad de `participation` y vinculada a una
  actividad y una inscripción del mismo tenant y programa.

Ambas tablas usan UUIDv7, auditoría temporal, versión optimista, claves foráneas
compuestas y RLS mediante `app.current_organization_id`. El rol de runtime no
puede crear objetos de esquema ni consultar filas sin contexto tenant.

`participation` orquesta la operación usando la API pública `ProgramActivities`.
`program` no depende de `participation`, por lo que se conserva la dirección
modular existente.

## API

- `GET /api/v1/organizations/{organizationId}/programs/{programId}/activities`
- `POST /api/v1/organizations/{organizationId}/programs/{programId}/activities`
- `GET /api/v1/me/programs/{programId}/activities`

Las dos primeras rutas requieren una membresía activa con rol `CONSULTANT` en la
organización. La ruta personal no acepta organización, inscripción ni usuario
desde el cliente: deriva la propiedad de la identidad autenticada.

## Validación manual

1. Iniciar `dev.cmd` e ingresar como consultor.
2. Abrir **Contenido** en un programa sin participantes y comprobar que inicialmente
   sólo se muestran sus dimensiones.
3. Desplegar una dimensión y una sesión, crear una actividad desde el modal y
   confirmar que persiste con cero asignaciones.
4. Agregar un colaborador `ACTIVE`, crear otra actividad para todos o para una
   selección individual y confirmar los destinatarios.
5. Cerrar sesión e ingresar con el colaborador asignado.
6. Abrir **Mis programas**, entrar al programa y comprobar la actividad asignada y
   su enlace de video cuando exista.
7. Verificar con otro colaborador activo del mismo programa que la actividad no
   aparece si no fue seleccionado.

## Continuación

El progreso agregado debe derivarse del estado `COMPLETED` documentado en el
siguiente incremento, no inferirse únicamente de la existencia de una asignación.
