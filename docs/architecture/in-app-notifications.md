# Notificaciones dentro de la aplicación

## Alcance

La campana del encabezado ofrece una bandeja personal persistente, contador de avisos sin leer, lectura individual y enlaces a la actividad o entrega correspondiente. Incluye avisos de todas las organizaciones a las que el usuario conserva acceso; cada aviso identifica organización y programa.

| Evento | Destinatario |
| --- | --- |
| Actividad asignada | Colaborador asignado |
| Entrega recibida | Consultores activos y autorizados de la organización |
| Cambios solicitados | Colaborador de la entrega |
| Actividad aprobada | Colaborador de la entrega |
| Encuesta pendiente después de enviar la actividad | Colaborador de la entrega |

No se generan correos, notificaciones del navegador ni recursos nuevos de AWS. Se conserva el flujo existente de correo de invitación/ingreso y los mensajes de seguridad de Cognito. Los recordatorios por vencimiento y la configuración de preferencias quedan fuera de este incremento.

## Persistencia y permisos

- `rti.activity_notifications` se escribe dentro de la misma transacción que la asignación, entrega o revisión. Un fallo al guardar el aviso revierte también la operación: no existe una cola externa ni envío posterior.
- La restricción única por organización, destinatario, asignación, tipo y versión evita duplicar un evento. Una nueva entrega tras solicitar cambios produce un aviso nuevo. La encuesta pendiente utiliza una clave única por asignación.
- Se usa UUIDv7 de PostgreSQL 18. La migración incorpora asignaciones pendientes, entregas actualmente en revisión y encuestas pendientes existentes; no inventa un historial de aprobaciones anteriores.
- RLS limita las filas a la organización activada en la transacción. Las consultas del buzón también exigen que el destinatario corresponda al usuario autenticado. La API no acepta un usuario o una organización elegidos por el cliente.
- Cada consulta y marcación vuelve a comprobar usuario, organización, membresías, roles, inscripción activa, programa activo y contenido no archivado. El colaborador debe haber completado el perfil. Los avisos almacenados en borrador aparecen al activar el programa.
- Suspender, retirar o completar la inscripción, cerrar el programa o revocar permisos oculta los avisos de ese alcance. No se utiliza el buzón como auditoría permanente. Al reincorporar, pueden volver a aparecer los avisos conservados que sigan cumpliendo estas reglas.
- El aviso de entrega recibida corresponde a la versión que sigue en revisión. Desaparece al revisarla. Puede aparecer antes de que el colaborador termine la encuesta; la vista de revisión conserva el bloqueo hasta completar ambos pasos.
- El aviso de encuesta pendiente desaparece al responderla. Los otros avisos del colaborador permanecen como novedades históricas mientras conserve el acceso activo.
- No se incluyen respuestas, comentarios de revisión ni datos DISC en las notificaciones.

## API y cliente

- `GET /api/v1/me/notifications`: 20 avisos por página, contador total de no leídos y `hasMore`. Cursor compuesto opcional `before` + `beforeId`, orden descendente estable por fecha e ID.
- `POST /api/v1/me/notifications/{id}/read`: lectura individual idempotente, `204`; `404` si no existe o ya no es visible para ese usuario. Ambos endpoints requieren JWT y responden sin caché.
- Refresco al abrir, volver a la pestaña, completar una operación de actividad y cada 60 segundos con la pestaña visible. No es tiempo real por WebSocket. También existe el botón Actualizar.
- El cierre de sesión aborta solicitudes, vacía el buzón y detiene sus refrescos. Los enlaces se construyen con rutas internas y vuelven a comprobar el acceso antes de navegar.
- Modal con cierre por Escape, foco contenido por el diálogo nativo y retorno a la campana, scroll interior y estado vacío/error. El enlace del colaborador abre los acordeones hasta su actividad; el del consultor prioriza la entrega en la bandeja de revisión.

## Validación manual local

1. Iniciar la app para aplicar la migración. Abrir dos perfiles de navegador separados: consultor y colaborador con perfil completo e inscripción activa.
2. Crear/asignar una actividad en un programa activo. En el colaborador, abrir la campana o Actualizar: debe aparecer Actividad asignada con su programa y organización.
3. Entrar desde Ver actividad: deben abrirse dimensión, sesión y actividad. Marcar otro aviso como leído y recargar: el contador y la lectura deben persistir.
4. Enviar una actividad con encuesta. El colaborador recibe Encuesta pendiente y el consultor Entrega recibida. Hasta responder la encuesta, la entrega aún no está lista para revisión.
5. Completar la encuesta: su aviso pendiente desaparece al actualizar. En el consultor, seguir el aviso y solicitar cambios; en el colaborador comprobar el nuevo aviso.
6. Reenviar y aprobar: comprobar el nuevo aviso de entrega y el de aprobación. Repetir Actualizar no debe duplicarlos.
7. Usar un colaborador distinto: no debe ver los avisos ajenos. Suspender la inscripción o cerrar el programa: sus avisos dejan de aparecer y un enlace antiguo no permite operar.
8. Repetir en móvil, cerrar con Escape en escritorio y cerrar sesión. No deben enviarse correos por ninguno de estos eventos.

## Cobertura automatizada

Las pruebas de integración cubren destinatario, lectura idempotente, acceso sin JWT, roles/perfil/membresías, RLS entre organizaciones, borrador/cierre/suspensión/archivo, cambios de estado, encuestas y paginación. Las pruebas de frontend cubren contador, lectura, errores, cierre de sesión, respuesta tardía, paginación y apertura de acordeones. Las pruebas de integración requieren Docker con PostgreSQL 18 desechable; no utilizan DEV.

Validación local del incremento (2026-10-21): `mvn verify`, 287 pruebas sin fallos;
frontend, 225 pruebas sin fallos, lint, TypeScript y build Webpack correctos;
16 smoke tests de navegador sin sesión. Comprobación visual adicional con APIs
interceptadas y datos ficticios a 375 y 1440 píxeles: sin desbordamiento, lectura,
cierre con Escape y retorno de foco a la campana. No se ejecutó el E2E real de
Cognito ni se desplegó este incremento en DEV durante esta validación.
