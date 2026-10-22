# Backlog de descubrimiento posterior al MVP

Este documento registra decisiones y necesidades surgidas de la reunión de
producto del 2026-09-14. No reemplaza el backlog canónico ni los ADR aceptados y
no declara implementadas estas capacidades. Su objetivo es conservar el contexto,
separar decisiones de preguntas abiertas y permitir convertir cada bloque en un
ticket verificable antes de desarrollarlo.

## Estado de la base actual

El producto ya permite crear organizaciones y programas, invitar colaboradores,
estructurar un programa, crear y asignar actividades, responderlas y revisarlas.
El siguiente backlog extiende esa base sin alterar el comportamiento aceptado.

## Necesidades registradas

### Preparación de primera empresa y dirección de marca

Checkpoint del 2026-10-20: piloto previsto de hasta 30 personas. Incorporados como
prioridad backups/restauración, dominio/subdominio propio para sustituir nip.io,
DKIM, prueba de carga, validación de permisos/datos, privacidad y operación estable.
El dominio está pendiente de elección y acceso DNS; no se compró ni configuró.
Estado, criterios y orden de trabajo en [preparación del piloto](pilot-readiness.md).

### Resultados de las encuestas de actividad

Implementado localmente el 2026-10-19, con commit y push autorizados: consulta
exclusiva del consultor de respuestas identificadas, distribución por pregunta,
medias por tipo de escala, emociones y respuestas abiertas; filtros y comparación
por dimensión, sesión y actividad; exportación CSV del alcance seleccionado.
La interpretación de denominadores, límites y pruebas manuales están en
[resultados de encuestas](activity-survey-results.md). No reemplaza las futuras
evaluaciones inicial/final ni amplía permisos de Líder/RRHH.

### Reportes del programa y exportaciones

Implementado el 2026-10-22, con commit y push autorizados por el usuario:
reportes general e individual para consultores, participación, avance, aprobación
y cumplimiento de fechas, integración de las encuestas y exportación CSV/Excel.
Definiciones, privacidad y pruebas en [reportes y exportaciones](program-reports-exports.md).
PDF corporativo y evaluaciones inicial/final permanecen pendientes.

### Edición y administración del contenido

Incremento implementado el 2026-10-19 y aprobado por el usuario para commit:
edición de dimensiones, sesiones, actividades y encuestas sin entregas;
reordenamiento entre hermanos, duplicación con encuesta, eliminación solo sin
asignaciones/respuestas y archivado/restauración sin entregas. Las instrucciones
y encuestas se congelan desde la primera entrega; título, video y fecha siguen
editables. Programas cerrados conservan la consulta sin escrituras.
Véanse las [reglas y el recorrido de validación](program-content-administration.md).

### Perfil inicial del colaborador

Decisión implementada localmente el 2026-09-20: después de aceptar una invitación,
el colaborador debe completar nombre completo, fecha de nacimiento, teléfono,
ciudad, país y cargo antes de acceder a sus programas. El correo proviene de su
identidad interna y la empresa de su membresía; ninguno puede ser modificado desde
el formulario.

El estado del perfil es independiente de la membresía y se persiste por nombre
simbólico como `PENDING` o `COMPLETE`. Una membresía `ACTIVE` con perfil pendiente
permite consultar la cuenta, aceptar invitaciones y completar el perfil, pero no
habilita las operaciones propias del colaborador sobre programas y actividades.
Los datos personales son globales al usuario; el cargo y el estado de completitud
pertenecen a su membresía en la organización.

### Roles de Líder y RRHH

Al invitar una persona a un programa, el consultor debe poder indicar si será
colaborador, líder de la empresa o integrante de RRHH. Cada tipo debe recibir los
permisos correspondientes. Decisión cerrada el 2026-09-15: ambos son roles de
organización; Líder usa `LEADER` y RRHH es la etiqueta de producto del rol técnico
existente `COMPANY_ADMIN`. No se introduce `HR`. La invitación registra el rol
seleccionado, mantiene su inscripción al programa y lo aplica al aceptarse. El
detalle futuro de visibilidad continúa pendiente y no se amplía en este incremento.

### Información DISC

Decisión implementada localmente el 2026-09-20: un consultor o un líder con
inscripción activa/completada en el programa registra cuatro campos de texto
independientes —Dominante, Influyente, Sereno y Concienzudo— para cada integrante
con rol `COLLABORATOR`. RRHH y colaboradores no reciben visibilidad.

La ficha pertenece a organización, programa e inscripción; usa RLS, control de
versión y un historial inmutable por cada creación o actualización. La interfaz
ofrece un recorrido individual de pendientes y permite editar fichas completas.
No se implementan cuestionarios, puntajes, exportación ni visibilidad del
colaborador.

### Plantillas de programa

Implementado el 2026-09-24: un programa completo puede convertirse en una plantilla
reutilizable y crear nuevos programas `DRAFT`. El snapshot copia dimensiones,
sesiones, actividades, fechas relativas y encuestas. Excluye personas, invitaciones,
asignaciones, entregas, respuestas, revisiones, progreso y DISC.

Base habilitada el 2026-09-20: el contenido del programa se gestiona como acordeón
**Dimensión → Sesión → Actividad**, los formularios se abren en modales y una
actividad puede existir sin participantes ni asignaciones. Esto permite preparar
la estructura reutilizable. La primera versión usa snapshots inmutables en un
catálogo global reutilizable entre organizaciones; la edición y el versionado explícito de plantillas quedan para una
iteración posterior. Véase [Plantillas reutilizables de programa](program-templates.md).

### Terminología del programa

- En el producto se hablará de **dimensiones**, no de módulos.
- La futura plantilla inicial contempla tres dimensiones: Interior, Exterior y
  Social. No son obligatorias ni fijas: el consultor podrá modificarlas.
- En las sesiones se utilizará **objetivo** en lugar de descripción.

Decisión cerrada el 2026-09-14: las dimensiones son configurables. La interfaz y
el cliente usan el nuevo lenguaje; la API v1 mantiene las rutas `/modules` y el
campo `moduleId` por compatibilidad. Se agregó `objective` de forma aditiva y el
contenido previo se conserva. Las plantillas no crean automáticamente estas tres
dimensiones: copian exactamente el contenido validado del programa fuente.

### Video de YouTube en actividades

Una actividad incluye opcionalmente un enlace de YouTube. El video se muestra
embebido en contenido y actividades del consultor y en actividades del colaborador,
con carga diferida, pantalla completa y enlace externo alternativo. Se validan
únicamente URLs HTTPS aprobadas y se extrae el identificador del video para
construir un iframe en `www.youtube-nocookie.com`; no se acepta HTML ni se propagan
parámetros arbitrarios del enlace. No hay reproducción automática.

El reproductor usa el [modo de privacidad mejorada de YouTube](https://support.google.com/youtube/answer/171780?hl=es).
La disponibilidad de cada video y el permiso de inserción dependen de su propietario.
Validación del incremento: [video, estados y acceso desde portada](video-status-home-polish.md).

### Fechas límite y notificaciones

La fecha límite existente servirá posteriormente para avisar que una actividad está
próxima a vencer o vencida. Este trabajo requiere definir ventanas de aviso, zona
horaria, destinatarios, canales, reintentos e idempotencia. No forma parte del
primer incremento de metadatos de YouTube.

Incremento de notificaciones internas: campana y bandeja con asignaciones,
entregas recibidas, cambios solicitados, aprobaciones y encuestas pendientes.
El canal acordado es exclusivamente dentro de la aplicación; no se agregan
correos por actividades. Los recordatorios por fecha siguen pendientes.
Contrato y validación: [notificaciones internas](in-app-notifications.md).

### Evaluaciones de inicio y cierre

El consultor de Refleja crea evaluaciones para el inicio y el final de un programa.
Las respuestas o resultados serán visibles para el colaborador correspondiente, el
líder y RRHH con acceso, y el consultor. Paula Rojas suministrará las preguntas; aún
deben definirse tipos de respuesta, obligatoriedad, edición, puntajes y comparación
entre evaluación inicial y final.

### Identidad visual

Se actualizarán el logo y la paleta del producto cuando estén disponibles los
activos y colores aprobados. La implementación actual continúa como una fundación
visual provisional y no debe convertirse en la fuente de identidad definitiva.

### Idioma

La traducción completa al español y la eliminación de textos técnicos visibles se
harán en una iteración posterior. Antes debe definirse si el producto será solamente
en español o si requiere internacionalización desde el inicio.

### Progreso del colaborador

El colaborador debe ver su progreso dentro del programa. La primera medición debe
derivarse de actividades asignadas y `COMPLETED`, distinguiendo pendientes, en
revisión, con cambios solicitados, completadas y vencidas. Las evaluaciones podrán
enriquecer el progreso más adelante, sin cambiar retroactivamente la semántica de
actividad completada.

Decisión implementada localmente el 2026-09-20: el primer cálculo usa únicamente
asignaciones de actividades, considera completada sólo una asignación `COMPLETED`
y presenta vencimiento como alerta derivada adicional. Incluye resumen de programa,
dimensión y sesión para el colaborador, además de una vista operativa por persona
para el consultor. No incluye evaluaciones, ponderaciones ni notificaciones.

### Encuestas posteriores a actividades — fundación local 2026-09-20

El consultor puede crear una encuesta directamente dentro de cada actividad del
acordeón de contenido. Se soportan escalas de acuerdo, escalas de probabilidad,
respuesta abierta y selección de máximo dos emociones. La interfaz previsualiza
cómo verá cada tipo de respuesta el colaborador. Las definiciones y preguntas
quedan persistidas y aisladas por organización, incluso antes de inscribir
participantes.

Extensión local del 2026-09-21: el colaborador responde la encuesta después de enviar
su actividad. La entrega representa 50% del avance y la encuesta el 50% restante; una
encuesta pendiente persiste entre sesiones y bloquea la entrada de la entrega a la
bandeja de revisión. Queda pendiente la consulta agregada de resultados.

## Ciclo de vida del programa

Incremento del 2026-10-19, con publicación autorizada por el usuario:
activación manual desde Borrador, finalización con advertencia de pendientes y
cancelación. Los programas cerrados quedan en consulta y conservan progreso,
entregas, encuestas e inscripciones. Las fechas no disparan cambios automáticos.
El colaborador realiza actividades únicamente en programas Activos. Reglas,
contrato, concurrencia y recorrido manual en [ciclo de vida](program-lifecycle.md).

## Secuencia propuesta de incrementos

La numeración oficial debe asignarse al convertir cada bloque en ticket.

1. **Alineación de terminología y contenido — implementado localmente:**
   dimensiones configurables, objetivo de sesión y enlace opcional de YouTube,
   con migración compatible y pruebas.
2. **Roles e invitaciones — implementado localmente:** selección entre Colaborador,
   Líder y RRHH, persistencia del rol solicitado y asignación al aceptar, sin ampliar
   las políticas de visibilidad existentes.
3. **Perfil inicial — implementado localmente:** formulario obligatorio, estado
   pendiente/completo y bloqueo de programas hasta completar los datos aprobados.
4. **Ficha DISC — implementado localmente:** cuatro campos por colaborador,
   acceso limitado a consultores y líderes inscritos, aislamiento tenant e
   historial inmutable de cambios.
5. **Progreso inicial — implementado localmente:** resumen del colaborador, vista
   operativa del consultor y desglose por programa, dimensión y sesión a partir de
   estados de actividades.
6. **Ambiente compartido de validación:** desplegar una versión pequeña y controlada
   para recibir retroalimentación de usuarios reales.
7. **Evaluaciones inicial/final:** comenzar cuando Paula entregue las preguntas y
   se apruebe el modelo de respuestas.
8. **Plantillas de programa:** reutilización de programas después de validar la
   estructura real del primer programa.
9. **Notificaciones de vencimiento:** recordatorios sobre la fecha límite existente.
10. **Identidad visual e idioma:** aplicar activos aprobados y la estrategia de
    traducción definida.

## Dependencias y decisiones pendientes

### Administración de participantes — incremento local 2026-10-20

Implementadas revocación, retiro, suspensión, cambio de rol, finalización de la
participación, reincorporación e historial. Los roles conservan alcance de
organización y el cambio exige confirmación; completar con pendientes conserva
solo consulta y progreso real. Se restringe acceso en backend sin borrar trabajo
ni deshabilitar Cognito globalmente. [Reglas y validación](participant-administration.md).
Publicado en `ffc2415`. La corrección E2E `aa57b0a` pasó CI y contenedores, y el
deploy `39541492017` terminó exitosamente con comprobaciones públicas HTTPS.
Continúan pendientes los criterios operativos del piloto.

Los resultados agregados de encuestas por pregunta/dimensión/sesión/actividad y
su exportación CSV ya están publicados; su alcance se detalla en
[resultados de encuestas](activity-survey-results.md).

| Tema | Responsable o decisión necesaria | Bloquea |
| --- | --- | --- |
| Campos del perfil básico | Resuelto: nombre completo, fecha de nacimiento, teléfono, ciudad, país y cargo; correo y empresa derivados | Implementado |
| Preguntas de evaluaciones | Paula Rojas | Evaluaciones |
| Alcance de Líder y RRHH | Parcialmente resuelto: roles de organización; visibilidad funcional pendiente | DISC y evaluaciones |
| Dimensiones fijas o configurables | Resuelto: configurables; una plantilla copia las dimensiones del programa fuente | Implementado |
| Retención y anonimización de DISC | Decisión de privacidad | Operación con datos reales a escala |
| Contenido y versionado de plantillas | Resuelto para V1: snapshot inmutable; edición/versionado explícito posterior | Implementado |
| Logo y paleta aprobados | Diseño/negocio | Actualización visual |
| Estrategia de idioma | Decisión de producto | Traducción/i18n |
| Reglas de avisos | Decisión operativa | Notificaciones |

## Límites

Registrar estas necesidades no autoriza cambios de roles, datos sensibles,
contratos REST, migraciones ni infraestructura. Cada incremento debe revisar los
ADR aceptados, definir criterios de aceptación, incluir aislamiento multiempresa y
ser validado de manera independiente.
