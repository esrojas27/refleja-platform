# Plantillas reutilizables de programa

## Alcance

Un consultor puede guardar como plantilla un programa completo y crear nuevas
cohortes en cualquier organización donde tenga acceso de consultor. El catálogo
es global para Refleja Tu Interior y la plantilla es un **snapshot
inmutable**: los cambios posteriores en el programa fuente no alteran plantillas
ya creadas.

La copia incluye:

- dimensiones y su orden;
- sesiones, objetivo, contenido y fecha relativa al inicio;
- actividades, instrucciones, enlace de YouTube y fecha límite relativa;
- encuesta de cada actividad y sus preguntas ordenadas.

No se copian inscripciones, invitaciones, roles, asignaciones, entregas,
respuestas, revisiones, progreso ni fichas DISC.

## Condición de completitud

La opción **Crear plantilla** solo se habilita cuando:

1. el programa tiene fechas de inicio y fin;
2. existe al menos una dimensión;
3. cada dimensión contiene al menos una sesión;
4. cada sesión contiene al menos una actividad;
5. cada actividad tiene una encuesta configurada.

La API vuelve a validar estas condiciones en la misma transacción; ocultar o
habilitar el botón no constituye una autorización.

## Catálogo global, aislamiento y permisos

- La organización guardada en la plantilla identifica únicamente la procedencia
  del programa fuente; no limita las organizaciones donde puede reutilizarse.
- Solo un miembro activo con rol `CONSULTANT` en la organización indicada por la
  ruta puede consultar el catálogo, crear una plantilla o materializarla.
- Para crear una plantilla, el programa fuente se resuelve dentro de la
  organización autorizada. Para utilizarla, la plantilla se obtiene del catálogo
  global y el programa nuevo se crea exclusivamente en la organización autorizada
  de destino.
- El resto de los datos operativos conserva RLS por organización. La tabla global
  de plantillas no almacena personas, ejecución ni resultados.
- El snapshot no almacena datos de personas ni resultados de ejecución.

## Fechas y materialización

La plantilla conserva la cantidad de días entre el inicio del programa fuente y
cada sesión o actividad. Al elegir una fecha de inicio nueva, esas distancias se
aplican a la nueva cohorte. El consultor sigue definiendo las fechas de inicio y
fin del programa resultante.

La materialización crea el programa en estado `DRAFT` y, dentro de una sola
transacción, crea dimensiones, sesiones, actividades y encuestas. Un error en
cualquier nivel revierte la operación completa.

## Contratos HTTP

- `GET /api/v1/organizations/{organizationId}/programs/{programId}/template-readiness`
- `GET /api/v1/organizations/{organizationId}/program-templates?page=0&size=20`
- `POST /api/v1/organizations/{organizationId}/program-templates`
- `POST /api/v1/organizations/{organizationId}/program-templates/{templateId}/programs`

Los contratos no admiten identificadores de destino, estado, versión, personas
ni asignaciones controlados por el cliente. En estas rutas, `organizationId`
representa el contexto autorizado de origen o destino, no la propiedad de la
plantilla. El catálogo admite páginas desde cero y un tamaño máximo de 100 elementos.
