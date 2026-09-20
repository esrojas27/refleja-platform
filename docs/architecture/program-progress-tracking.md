# Seguimiento de progreso del programa

## Alcance

Este incremento convierte las asignaciones de actividades existentes en una vista
de avance para el colaborador y una vista operativa para el consultor. El progreso
no se persiste ni se modifica manualmente: se calcula en cada consulta a partir de
las actividades que el usuario ya está autorizado a ver.

El colaborador ve el porcentaje general de su programa, los conteos por estado y
el desglose por dimensión y sesión. Cada tarjeta de actividad muestra una etiqueta
de flujo y, cuando corresponde, una etiqueta adicional **Vencida**.

El consultor dispone de **Progreso** dentro de la navegación lateral del programa.
La vista resume todas las asignaciones autorizadas, agrupa el avance por dimensión
y sesión y ordena a los colaboradores de menor a mayor progreso para facilitar el
acompañamiento.

La navegación del colaborador separa **Resumen**, que contiene los datos del
programa y su progreso, de **Actividades**, que contiene el trabajo asignado y sus
acciones. En la vista del consultor, la creación se abre desde **Crear y asignar**
en un diálogo y no ocupa permanentemente el área de seguimiento. Las respuestas
`SUBMITTED` se presentan en una bandeja secuencial de revisión; si la bandeja está
vacía, la interfaz lo comunica explícitamente. Esta interacción no introduce un
nuevo estado ni altera el contrato de revisión existente.

## Semántica

El porcentaje se calcula como:

`asignaciones COMPLETED / total de asignaciones × 100`

El resultado se redondea al entero más cercano. Un programa sin asignaciones tiene
avance `0 %`. Los estados persistidos conservan su significado actual:

- `ASSIGNED`: pendiente.
- `SUBMITTED`: en revisión.
- `CHANGES_REQUESTED`: requiere cambios.
- `COMPLETED`: completada y aprobada.

**Vencida** no es un quinto estado ni una transición de workflow. Es una alerta
derivada que aparece cuando `dueDate` es anterior a la fecha local actual y la
asignación todavía no está `COMPLETED`. Por eso una actividad puede mostrarse, por
ejemplo, como **En revisión** y **Vencida** al mismo tiempo. Este incremento no
envía notificaciones ni penaliza automáticamente al colaborador.

## Contrato y límites modulares

Las respuestas existentes de actividades agregan de manera compatible
`dimensionName` y `sessionName`. Estos valores son resueltos por el módulo
`program`; `participation` continúa siendo propietario de las asignaciones y sus
estados.

No se agregan tablas, migraciones ni columnas. La aplicación web consume:

- `GET /api/v1/me/programs/{programId}/activities` para el progreso propio;
- `GET /api/v1/organizations/{organizationId}/programs/{programId}/activities`
  para la vista operativa del consultor.

El primer endpoint deriva la persona y su inscripción del `sub` validado. El
segundo conserva la autorización `CONSULTANT` y el contexto tenant existente. El
navegador nunca envía un identificador de participante para obtener progreso.

## Fuera de alcance

- calificaciones, puntajes y ponderaciones;
- progreso derivado de evaluaciones;
- objetivos manuales o modificación directa del porcentaje;
- notificaciones de vencimiento;
- archivos, evidencias o rúbricas;
- acceso operativo para Líder o RRHH, pendiente de una política aprobada.
