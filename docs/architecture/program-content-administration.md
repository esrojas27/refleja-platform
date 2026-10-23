# Edición y administración del contenido del programa

Incremento del 2026-10-19, aprobado por el usuario para commit local.
Amplía el acordeón **Dimensión → Sesión → Actividad** sin cambiar IDs ni el
contrato compatible de creación bajo `/modules`.

## Reglas confirmadas

- Solo el consultor autorizado de la organización puede administrar contenido.
  Líder, RRHH y colaborador no reciben estas operaciones.
- Al crear o editar una encuesta, las flechas **Subir/Bajar pregunta** cambian su
  orden conservando enunciado y tipo de respuesta. La numeración se recalcula de
  1 a N y se persiste al guardar, con la versión de encuesta al editar. El
  colaborador recibe ese mismo orden. Desde la primera entrega queda bloqueado,
  igual que el resto de cambios de la encuesta; para otra versión se duplica.
- Borrador/Programado/Activo admiten preparación y corrección. Finalizado/Cancelado
  siguen siendo solo consulta; no se introduce reapertura.
- Dimensiones: editar nombre y descripción. Sesiones: editar nombre, objetivo y
  fecha. Actividades: editar título, instrucciones, YouTube y fecha límite.
- Desde la primera entrega de cualquier asignación, se congelan las instrucciones
  de la actividad y toda su encuesta, incluso su creación retroactiva. Se pueden
  corregir título, video y fecha límite. Para otro enunciado o preguntas se duplica.
- Se bloquea archivar una actividad con entregas, o una sesión/dimensión que las
  contenga. Los registros históricos se conservan.
- Eliminar definitivamente solo está permitido sin ninguna asignación ni
  respuesta en todo el subárbol. El modal advierte que no es recuperable.
  Nunca se convierte silenciosamente una eliminación en un archivado.
- El contenido con asignaciones pendientes, pero sin entregas, puede archivarse.
  Se conservan sus asignaciones; deja de contar en las tareas y el progreso
  vigente del colaborador y en nuevas plantillas. Restaurar vuelve a incluirlo.
  No se modifican estados de asignaciones ni respuestas durante el archivado.
- Archivar un padre no sobrescribe el estado propio de sus hijos. Para restaurar
  o modificar un hijo de padre archivado hay que restaurar primero el padre.
- Subir/bajar intercambia posiciones entre hermanos vigentes, nunca cambia de
  dimensión o sesión. Los huecos de posición tras archivar/eliminar son válidos.
- Duplicar crea una actividad al final de la misma sesión, con nuevos IDs para su
  definición, encuesta y preguntas. Copia instrucciones, video y fecha; no copia
  entregas, revisiones, respuestas ni progreso. Por defecto queda sin asignaciones;
  se puede elegir todos los colaboradores activos o una selección validada.
- Una plantilla ya guardada conserva su snapshot inmutable; editar su programa
  fuente no cambia plantillas ni otros programas creados previamente desde ellas.

## Contratos y consistencia

Prefijo: `/api/v1/organizations/{organizationId}/programs/{programId}/content`.

| Método y sufijo | Entrada relevante | Resultado |
| --- | --- | --- |
| PUT `dimensions/{id}` | name, description, version | 204 |
| PUT `sessions/{id}` | name, objective, scheduledDate, version | 204 |
| PUT `activities/{id}` | title, instructions, youtubeUrl, dueDate, version | 204 |
| PUT `activities/{id}/survey` | title, instructions, questions, version de encuesta | 200 encuesta |
| POST `{kind}/{id}/move` | version, direction UP/DOWN | 204 |
| POST `{kind}/{id}/archive` | version, archived true/false | 204 |
| POST `{kind}/{id}/delete` | version | 204 |
| POST `activities/{id}/duplicate` | version, assignToAll, enrollmentIds | 201 nuevo ID |

`kind` acepta dimensions, sessions o activities. El GET compatible de estructura
y actividades recibe `includeArchived=true` para administración; por defecto
omite archivados propios o heredados. El colaborador no dispone de esa opción.

Cada escritura resuelve permisos reales, activa RLS de la organización, bloquea
la fila del programa, comprueba su ciclo de vida y la versión esperada. Comparte
el bloqueo con entregas y respuestas para impedir carreras al congelar contenido.
Survey usa su propia versión; una edición solo de preguntas también la incrementa.

La eliminación valida asignaciones/respuestas en servicio y persistencia, elimina
primero preguntas/encuestas y después actividades/sesiones/dimensiones en una
misma transacción. Las FK restrictivas se mantienen. No se usa cascade de borrado
de información del participante. Las referencias ajenas o inexistentes devuelven
404 sin exponer otra organización.

La migración `V20261019020000` añade flags archived=false y hace diferibles las
restricciones de posición. Solo el intercambio de orden difiere esas restricciones;
las creaciones normales continúan verificándolas inmediatamente.

Las respuestas son no-store y llevan requestId. Los errores de negocio 409
CONTENT_VERSION_CONFLICT, CONTENT_HAS_ASSIGNMENTS, CONTENT_HAS_SUBMISSIONS,
CONTENT_ARCHIVED, CONTENT_PARENT_ARCHIVED y CONTENT_ORDER_BOUNDARY se traducen en
instrucciones para el usuario. No hay reintentos automáticos de escrituras.
Los cambios exitosos registran acción, actor, organización, programa, recurso,
requestId y fecha después del commit, sin registrar instrucciones ni respuestas.
Se trata de logs de auditoría, no de una pantalla de historial ni rollback.

## Validación manual

1. Reiniciar `dev.cmd` para aplicar la migración local. Usar un programa de prueba
   Borrador o Activo y entrar como consultor.
2. En Contenido, editar una dimensión y el objetivo/fecha de una sesión. Recargar:
   conservar estructura, actividades y asignaciones.
3. Crear dos elementos hermanos de cada nivel y usar Subir/Bajar. Recargar y
   comprobar el mismo orden en las actividades del colaborador.
4. Editar título/instrucciones/video/fecha de una actividad sin entregas. Corregir
   una pregunta de su encuesta y verificar que persiste.
5. Duplicar: comprobar copia al final, encuesta completa y ausencia de entregas.
   Probar sin asignaciones, todos y selección individual.
6. Eliminar una actividad sin asignaciones y su encuesta; repetir con una
   dimensión de prueba sin asignaciones para verificar eliminación del subárbol.
   Cancelar primero el modal y confirmar que no elimina nada.
7. Con asignaciones sin entregas, comprobar Eliminar bloqueado y archivar mediante
   confirmación. Como colaborador, verificar que deja de aparecer y contar.
8. Activar Mostrar archivados, restaurar y comprobar que reaparecen las mismas
   asignaciones. Archivar un padre con un hijo previamente archivado: al restaurar
   el padre, ese hijo debe seguir archivado.
9. Enviar una actividad como colaborador. Como consultor, verificar instrucciones
   protegidas, encuesta/archivo/eliminación bloqueados y título/video/fecha editables.
   Duplicar permite preparar una versión nueva sin alterar esa entrega.
10. Abrir dos pestañas, modificar en una y guardar la versión antigua en la otra:
    debe pedir actualizar sin sobrescribir el cambio.
11. Finalizar un programa de prueba y comprobar consulta sin administración.
    Verificar ausencia de estas acciones con Líder/RRHH/colaborador.
12. Repetir el recorrido de Contenido en ancho móvil: controles ajustados al ancho,
    acordeones y modales con desplazamiento interno.

No se incluye mover contenido entre padres/programas, edición masiva,
restauración de elementos eliminados, revisión de snapshots existentes ni
versionado histórico de encuestas ya respondidas.

## Verificación local

- API: `mvn.cmd -o verify`, con PostgreSQL 18/Testcontainers y límites temporales
  de memoria: 257 pruebas correctas, sin fallos, errores ni omisiones.
- Frontend: `npm.cmd test -- --maxWorkers=1`: 182 pruebas correctas en 30 archivos.
  La comprobación focalizada posterior de los componentes de contenido y su
  cliente API completa 21 pruebas correctas.
- TypeScript sin emisión y ESLint: correctos.
- `git diff --check`: correcto.

Se comprueban versiones obsoletas, permisos y alcance de organización, orden
atómico, archivo/restauración heredados, bloqueo de entrega en archivadas,
protección de instrucciones/encuestas desde la primera entrega, eliminación
condicionada, duplicación sin datos personales, asignación seleccionada y
conservación de snapshots ya creados. El test de migraciones incluye la nueva
versión. No se levantó Next.js ni se ejecutó el journey real con Cognito;
La aceptación del usuario autoriza guardar el incremento en Git.
Los gates remotos siguen pendientes; no se realizó push ni despliegue.
