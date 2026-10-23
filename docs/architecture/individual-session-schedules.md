# Agenda individual de sesiones

## Reglas aprobadas

- Las sesiones y actividades se crean sin fecha general. Solo el consultor asigna
  o modifica fechas de sesión, individualmente o para un subgrupo del programa.
- Una sesión se vuelve visible inmediatamente cuando la persona tiene fecha,
  aunque sea futura. Sin agenda no se exponen sus actividades ni se permite
  enviar una entrega o encuesta mediante un enlace directo.
- El consultor, Líder y RRHH consultan la agenda del programa; solamente el
  consultor puede escribirla. El colaborador consulta únicamente sus fechas.
- Una fecha asignada no se elimina. Cambiarla exige un motivo, conserva historial
  inmutable y genera un aviso privado dentro de la aplicación; nunca un correo.
- No se permiten fechas pasadas ni anteriores al inicio del programa, usando
  la zona horaria de la organización. Se pueden asignar y reprogramar sesiones
  después del fin previsto: el formulario lo advierte sin bloquear ni modificar
  las fechas del programa. El vencimiento de actividades sigue siendo tres días
  calendario después de la sesión individual, aunque supere el fin del programa.
- Al reprogramar solo cambian los vencimientos de asignaciones pendientes o con
  cambios solicitados. Entregadas/en revisión y completadas conservan el suyo.
- La agenda es la fuente de destinatarios: guardar una fecha asigna todas las
  actividades no archivadas de esa sesión a los participantes seleccionados.
  Crear o duplicar una actividad la asigna a las inscripciones activas/invitadas
  habilitadas que ya tienen fecha. Sin fecha no hay nuevas asignaciones.
  Restaurar contenido incorpora las asignaciones faltantes según su agenda.
  Repetir la misma fecha completa asignaciones faltantes sin duplicar trabajo,
  avisos ni historial de agenda. Nunca se sobrescriben entregas ni respuestas.
  Agendar no acepta la invitación ni activa una inscripción automáticamente.
- Programas cerrados son solo consulta. Inscripciones retiradas/suspendidas y
  cuentas deshabilitadas no recuperan acceso por disponer de una agenda.

## Datos y migración

`V20261023010000` agrega `session_schedules`, `session_schedule_history`,
`session_schedule_notifications` y un vencimiento por `activity_assignment`.
La migración copia la fecha general existente a cada inscripción existente y
conserva exactamente los vencimientos anteriores de sus asignaciones, estados,
entregas, respuestas, versiones y progreso. Registra el origen `MIGRATED`, sin
inventar un actor ni generar avisos. No borra programas ni reinicia datos de DEV.

Las fechas históricas de las definiciones permanecen como datos, pero no se usan
como respaldo ni se copian al materializar plantillas. Todo contenido nuevo usa
la agenda individual, también si se agrega a un programa anterior. Las plantillas
copian únicamente contenido, nunca participantes, agendas o avisos personales.

Las tablas tienen aislamiento RLS por organización y FK compuestas que impiden
cruzar programas/inscripciones. El rol de aplicación no puede modificar ni borrar
el historial. El bloqueo del programa serializa reprogramaciones, entregas,
revisiones y cambios de ciclo de vida. Se exige la versión actual de cada agenda;
un lote inválido no modifica parcialmente participantes. Repetir la misma fecha
es un no-op: no genera un segundo aviso ni una nueva revisión.

Una sesión/dimensión con agenda se archiva, no se elimina definitivamente, para
conservar su historial. Las restricciones previas por entregas siguen aplicando.

## Rutas

- `GET /organizations/{org}/programs/{program}/session-schedules`: agenda completa.
- `POST /organizations/{org}/programs/{program}/sessions/{session}/schedules`:
  fecha, participantes con versión actual y motivo cuando se reprograma.
- `GET /organizations/{org}/programs/{program}/sessions/{session}/schedule-history`:
  historial paginado por inscripción.
- `GET /me/programs/{program}/sessions`: agenda propia, solo sesiones agendadas.

Las rutas llevan el prefijo `/api/v1`. Lecturas y mutaciones no se almacenan en
caché. Los reportes/exportaciones y el progreso utilizan vencimientos individuales;
una asignación sin fecha no se marca como vencida ni tiene una fecha inventada.

## Validación manual

1. Crear una sesión desde Contenido: no se solicita fecha. Crear una actividad:
   tampoco se solicita vencimiento; elegir sus destinatarios como antes.
2. Abrir **Agendar participantes** dentro de la sesión, o **Agenda** en el menú.
   Seleccionar solo un subgrupo y una fecha válida; guardar. Deben asignarse las
   actividades de esa sesión, no de otras. Crear otra actividad después: debe
   asignarse al subgrupo ya agendado sin solicitar destinatarios.
3. Comprobar con dos colaboradores que solo quien tiene fecha ve la sesión y sus
   actividades asignadas. La fecha límite debe ser sesión + 3 días calendario.
4. Reprogramar con motivo. Comprobar historial, aviso privado y nuevos vencimientos
   pendientes; una entrega ya enviada conserva su vencimiento anterior.
5. Entrar como Líder/RRHH: pueden consultar agendas e historial, no modificarlos.
6. Probar fecha pasada/anterior al inicio, reprogramación sin motivo y edición
   desactualizada. Agendar después del fin previsto: debe advertir pero permitir
   guardar y mantener vencimiento a sesión + 3 días. Cerrar el programa o suspender
   una inscripción y verificar acceso.
7. Crear desde una plantilla: no debe heredar fechas personales ni vencimientos.

La prueba `SessionScheduleMigrationTests` ensaya la actualización de una base
anterior con entregas existentes en un PostgreSQL desechable, no en DEV.
