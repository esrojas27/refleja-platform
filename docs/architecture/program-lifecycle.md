# Ciclo de vida del programa

Implementación del 2026-10-19. El usuario autorizó el commit y la publicación de
esta iteración; la validación remota se realizará con los gates de GitHub.

## Decisiones de producto

El usuario confirmó que Borrador sirve para preparación, que la activación es
manual y que se permite finalizar con pendientes conservando todo para consulta.
Las fechas no activan, vencen ni finalizan automáticamente el programa.

| Estado actual | Acciones disponibles para el consultor |
| --- | --- |
| `DRAFT` / Borrador | Activar o cancelar |
| `SCHEDULED` / Programado, compatibilidad con datos existentes | Activar manualmente o cancelar |
| `ACTIVE` / Activo | Finalizar o cancelar |
| `COMPLETED` / Finalizado | Solo consulta |
| `CANCELLED` / Cancelado | Solo consulta |

No se agrega una operación para programar activaciones, reabrir programas,
archivarlos, eliminarlos ni editar/reordenar su contenido. La activación no exige
que todas las actividades tengan encuesta: ese requisito corresponde a la creación
de plantillas, y no se extiende al ciclo de vida de programas existentes.

## Comportamiento

- Solo `CONSULTANT` activo en la organización puede cambiar el estado.
- En preparación se permiten contenido, invitaciones y DISC. El colaborador
  inscrito puede consultar los datos básicos del programa y ve un aviso de
  preparación; la API no expone sus actividades asignadas hasta la activación.
- En Activo se habilitan entregas, encuestas y revisión del consultor. El programa
  puede seguir recibiendo contenido e invitaciones.
- Al finalizar o cancelar se conservan contenido, inscripciones, roles, respuestas,
  encuestas, DISC y progreso. No se modifica el estado de las inscripciones ni se
  completan actividades pendientes artificialmente.
- Cancelar un borrador nunca activado mantiene ocultas sus actividades al
  colaborador; cancelar un programa que sí estuvo activo conserva su consulta.
- El programa cerrado bloquea nuevas dimensiones, sesiones, actividades, encuestas,
  inscripciones, reenvíos de invitación, aceptación de invitaciones pendientes,
  entregas, respuestas de encuesta, revisión de entregas y edición DISC.
- La consulta de los datos existentes conserva los permisos previos. Se puede
  seguir creando una plantilla desde su contenido: esa operación produce otro
  recurso sin modificar el programa cerrado.
- La interfaz pide confirmación para activar y para cerrar. El cierre advierte que
  puede haber entregas, encuestas o revisiones pendientes y que no hay reapertura.
- Un resultado de red incierto o un conflicto deshabilita repetir el cambio hasta
  actualizar el estado. Una página antigua también recibe el bloqueo de la API.

## Contrato y concurrencia

`POST /api/v1/organizations/{organizationId}/programs/{programId}/status`

```json
{ "status": "ACTIVE", "version": 0 }
```

Devuelve `200` con el programa y su nueva versión. El cuerpo solo permite como
destino `ACTIVE`, `COMPLETED` o `CANCELLED`. No cambia la forma de crear programas:
la creación desde cero o desde plantilla sigue produciendo `DRAFT`.

La autorización y el contexto RLS se resuelven antes de consultar el programa.
El cambio exige la versión actual y mantiene un bloqueo de fila hasta el fin de
la transacción. Las escrituras relacionadas toman el mismo bloqueo antes de
comprobar el estado, para serializar cierres y entregas concurrentes. Se refresca
la entidad bloqueada para evitar decisiones sobre una lectura anterior.

Errores `409`: `PROGRAM_VERSION_CONFLICT`, `PROGRAM_TRANSITION_NOT_ALLOWED`,
`PROGRAM_READ_ONLY` o `PROGRAM_NOT_ACTIVE`. Los recursos ajenos o inexistentes
conservan el `404` indistinguible. Las respuestas son `no-store` y llevan requestId.
Después del commit se registra `PROGRAM_STATUS_CHANGED` con actor, organización,
programa, estado anterior/nuevo, versión y requestId en el log de auditoría.
No se incorpora una pantalla de historial persistido en este incremento.

La migración aditiva `V20261019010000` registra `activated_at`. Los programas
preexistentes `ACTIVE`/`COMPLETED` conservan su acceso; los que ya existían como
`DRAFT` deben activarse expresamente desde su resumen. No se cambia ningún estado
automáticamente ni se elimina contenido.

## Validación manual

1. Entrar como consultor y abrir el resumen de un programa Borrador.
2. Confirmar estado en español y botones Activar programa / Cancelar programa.
3. Preparar dimensiones, sesiones, actividades, encuestas e invitaciones.
4. Aceptar una invitación y completar el perfil como colaborador. Verificar que
   el programa indica preparación y no deja responder actividades ni encuestas.
5. Activar desde el resumen y confirmar en el modal. Al recargar como colaborador,
   comprobar que aparecen las actividades y se permite su ejecución.
6. Enviar una actividad con encuesta y dejarla al 50% para comprobar conservación.
7. Como consultor, finalizar y leer la advertencia de pendientes antes de confirmar.
8. Recargar como colaborador: conservar respuesta y 50%, sin formularios de entrega
   ni encuesta, sin próxima actividad y sin contador de tareas accionables.
9. Recorrer Contenido, Actividades, Colaboradores y DISC como consultor: consulta
   disponible y operaciones de modificación bloqueadas. Verificar progreso real.
10. Repetir con otro programa y Cancelar. Confirmar que no hay reapertura.
11. Verificar que Líder/RRHH y colaboradores no reciben controles de cambio de estado.
12. Abrir el mismo resumen en dos pestañas: cambiar estado en una y comprobar que
    la otra pide actualizar antes de repetir una transición con versión anterior.

El journey MVP de Playwright incorpora la activación manual antes de continuar
con el recorrido del colaborador. No se alteran las credenciales Cognito/SES.

## Verificación local del 2026-10-19

- `mvn.cmd -o "-Dtest=*Test" test`: 49 pruebas unitarias/de arquitectura correctas;
  también compila todas las clases de prueba de integración.
- `npm.cmd test -- --maxWorkers=1`: 167 pruebas correctas en 29 archivos.
- `tsc.cmd --noEmit --incremental false`: correcto.
- `npm.cmd run lint`: correcto.
- Playwright `--list` reconoce el journey MVP actualizado; no se ejecutó el viaje
  real con Cognito ni se levantó Next.js.
- `git diff --check`: correcto.

Antes de publicar, Docker ya estuvo disponible y se completó `mvn.cmd -o verify`
con PostgreSQL 18/Testcontainers: **243 pruebas sin fallos, errores ni omisiones**,
empaquetado correcto y validación de la migración `V20261019010000`. Se usaron
límites temporales de memoria (Maven 256 MiB, pruebas 384 MiB y 2 procesadores),
sin cambiar la configuración del proyecto ni tocar la base de desarrollo.

La prueba de bloqueo de invitaciones se ejecuta en la suite con datos confirmados,
porque ese flujo suspende la transacción del llamador antes de operar con sus
transacciones propias. Verifica creación, reenvío y aceptación bloqueados después
del cierre y ausencia de llamadas al proveedor de correo.

La ejecución remota de los gates de GitHub queda pendiente después del push. El
recorrido real con Cognito y la validación visual no se repitieron durante esta
publicación; el usuario dispone del procedimiento manual anterior.
