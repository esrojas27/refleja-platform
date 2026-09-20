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

### Perfil inicial del colaborador

Después de su primer inicio de sesión, el colaborador debe completar información
básica antes de que su cuenta quede validada. La lista de campos, sus reglas y cuáles
son obligatorios serán suministrados por Tata. Hasta recibirla no se debe diseñar el
modelo definitivo ni considerar que `ACTIVE` equivale a perfil completo.

### Roles de Líder y RRHH

Al invitar una persona a un programa, el consultor debe poder indicar si será
colaborador, líder de la empresa o integrante de RRHH. Cada tipo debe recibir los
permisos correspondientes. Decisión cerrada el 2026-09-15: ambos son roles de
organización; Líder usa `LEADER` y RRHH es la etiqueta de producto del rol técnico
existente `COMPANY_ADMIN`. No se introduce `HR`. La invitación registra el rol
seleccionado, mantiene su inscripción al programa y lo aplica al aceptarse. El
detalle futuro de visibilidad continúa pendiente y no se amplía en este incremento.

### Información DISC

El líder de la empresa debe poder registrar información DISC para cada colaborador.
Se requieren cuatro campos de texto independientes: D, I, S y C. Esta información
sólo debe ser visible para líderes autorizados de la empresa y consultores de
Refleja Tu Interior. Deben definirse edición, auditoría y alcance por organización
o programa antes de implementar la persistencia.

### Plantillas de programa

Un programa existente podrá convertirse en una plantilla reutilizable para crear
nuevos programas. Se debe definir qué se copia —dimensiones, sesiones, actividades,
fechas relativas y evaluaciones—, qué información se excluye y cómo se versiona una
plantilla después de haber sido utilizada.

### Terminología del programa

- En el producto se hablará de **dimensiones**, no de módulos.
- La futura plantilla inicial contempla tres dimensiones: Interior, Exterior y
  Social. No son obligatorias ni fijas: el consultor podrá modificarlas.
- En las sesiones se utilizará **objetivo** en lugar de descripción.

Decisión cerrada el 2026-09-14: las dimensiones son configurables. La interfaz y
el cliente usan el nuevo lenguaje; la API v1 mantiene las rutas `/modules` y el
campo `moduleId` por compatibilidad. Se agregó `objective` de forma aditiva y el
contenido previo se conserva. La creación de plantillas continúa pendiente.

### Video de YouTube en actividades

Una actividad podrá incluir opcionalmente un enlace de YouTube. En una iteración
posterior se mostrará el video embebido. El primer incremento ya valida y conserva
únicamente URLs HTTPS aprobadas y las presenta como enlace externo; no acepta HTML
ni código de inserción enviado por el cliente.

### Fechas límite y notificaciones

La fecha límite existente servirá posteriormente para avisar que una actividad está
próxima a vencer o vencida. Este trabajo requiere definir ventanas de aviso, zona
horaria, destinatarios, canales, reintentos e idempotencia. No forma parte del
primer incremento de metadatos de YouTube.

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

## Secuencia propuesta de incrementos

La numeración oficial debe asignarse al convertir cada bloque en ticket.

1. **Alineación de terminología y contenido — implementado localmente:**
   dimensiones configurables, objetivo de sesión y enlace opcional de YouTube,
   con migración compatible y pruebas.
2. **Roles e invitaciones — implementado localmente:** selección entre Colaborador,
   Líder y RRHH, persistencia del rol solicitado y asignación al aceptar, sin ampliar
   las políticas de visibilidad existentes.
3. **Perfil inicial:** implementar la validación del perfil cuando Tata entregue
   los campos y reglas.
4. **Ficha DISC:** cuatro campos por colaborador con autorización y aislamiento
   tenant, una vez definido el alcance y la auditoría.
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

| Tema | Responsable o decisión necesaria | Bloquea |
| --- | --- | --- |
| Campos del perfil básico | Tata | Perfil inicial |
| Preguntas de evaluaciones | Paula Rojas | Evaluaciones |
| Alcance de Líder y RRHH | Parcialmente resuelto: roles de organización; visibilidad funcional pendiente | DISC y evaluaciones |
| Dimensiones fijas o configurables | Resuelto: configurables; los tres nombres pertenecen a la futura plantilla | Plantillas |
| Alcance y auditoría de DISC | Decisión de producto y privacidad | Ficha DISC |
| Contenido y versionado de plantillas | Decisión de producto | Plantillas |
| Logo y paleta aprobados | Diseño/negocio | Actualización visual |
| Estrategia de idioma | Decisión de producto | Traducción/i18n |
| Reglas de avisos | Decisión operativa | Notificaciones |

## Límites

Registrar estas necesidades no autoriza cambios de roles, datos sensibles,
contratos REST, migraciones ni infraestructura. Cada incremento debe revisar los
ADR aceptados, definir criterios de aceptación, incluir aislamiento multiempresa y
ser validado de manera independiente.
