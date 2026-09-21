# Ficha DISC por participante del programa

## Alcance

Un consultor de Refleja Tu Interior o un líder autorizado del programa puede
registrar una ficha DISC para cada integrante con rol `COLLABORATOR`. La ficha
contiene cuatro textos independientes y obligatorios:

- D — Dominante;
- I — Influyente;
- S — Sereno;
- C — Concienzudo.

DISC no es un test automático ni calcula puntajes. Este incremento conserva la
lectura cualitativa ingresada por la persona autorizada y no la muestra al
colaborador, RRHH ni otros roles.

## Autorización y alcance

La API vuelve a resolver identidad, membresía y roles desde el Access Token en
cada operación. Se permite acceso a:

- una membresía activa con rol `CONSULTANT` en la organización seleccionada;
- una membresía activa con rol `LEADER` que además tenga una inscripción
  `ACTIVE` o `COMPLETED` en el programa solicitado.

`COMPANY_ADMIN`, `COLLABORATOR` y líderes no inscritos en el programa reciben
`403`. El destino debe ser una inscripción activa o completada cuya membresía
actual incluya el rol `COLLABORATOR`. La API no acepta identificadores de usuario
ni roles elegidos por el navegador.

## Persistencia, aislamiento y auditoría

`program_participant_disc_profiles` mantiene una ficha por organización,
programa e inscripción. Los cuatro textos admiten entre 1 y 5.000 caracteres.
La fila registra quién la creó, quién la actualizó, fechas y versión optimista.

Cada creación o actualización agrega una instantánea a
`program_participant_disc_profile_revisions`. El rol de ejecución sólo tiene
`SELECT` e `INSERT` sobre este historial, por lo que no puede modificar ni borrar
revisiones. Ambas tablas usan RLS con `app.current_organization_id`; una
organización no puede consultar o alterar fichas de otra aunque conozca sus UUID.
La aplicación emite además un evento estructurado después de confirmar la
transacción, sin incluir el contenido sensible de la ficha.

## Contrato HTTP

- `GET /api/v1/organizations/{organizationId}/programs/{programId}/disc-profiles`
  devuelve únicamente colaboradores elegibles y su ficha, si existe.
- `PUT /api/v1/organizations/{organizationId}/programs/{programId}/disc-profiles/{enrollmentId}`
  crea o actualiza los cuatro campos. Para actualizar exige la última `version`;
  un valor obsoleto produce `409`.
- Las respuestas usan `Cache-Control: no-store`.

## Experiencia web

La navegación del programa muestra **DISC** sólo después de confirmar un rol
`CONSULTANT` o `LEADER`. La vista presenta métricas de fichas completas y
pendientes, un recorrido individual semejante a la bandeja de revisión de
actividades y un listado desde el que puede editarse cualquier ficha existente.
Al guardar una ficha pendiente, el recorrido avanza al siguiente colaborador.

## Validación manual

1. Abrir un programa como consultor y confirmar la opción **DISC**.
2. Verificar que el listado incluya colaboradores y excluya líderes y RRHH.
3. Pulsar **Completar pendientes**, ingresar D, I, S y C y guardar.
4. Confirmar que la ficha cambie a **Completa** y que el recorrido avance.
5. Volver a editarla y confirmar que el cambio se guarde sin duplicar la ficha.
6. Ingresar como líder inscrito en ese programa y repetir la consulta/edición.
7. Confirmar que RRHH, un colaborador y un líder de otro programa no puedan ver
   la información.

## Límites

No se implementan cuestionarios DISC, puntajes, archivos, exportación, borrado,
aprobación ni visibilidad para el colaborador. Tampoco se define todavía una
política de retención o anonimización; esa decisión de privacidad debe tratarse
antes de operar con datos reales a escala.
