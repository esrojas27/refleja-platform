# Encuestas posteriores a actividades

Fecha: 2026-09-20

## Alcance habilitado

- Cada actividad puede tener una única encuesta.
- El consultor crea la encuesta desde `Contenido`, dentro de la actividad correspondiente.
- La encuesta contiene entre 1 y 20 preguntas ordenadas.
- Tipos disponibles:
  - `AGREEMENT_SCALE`: escala de 1 a 5, desde “Totalmente en desacuerdo” hasta “Totalmente de acuerdo”.
  - `LIKELIHOOD_SCALE`: escala de 1 a 5, desde “Muy improbable” hasta “Muy probable”.
  - `OPEN_TEXT`: respuesta abierta.
  - `EMOTION_MULTI_SELECT`: emociones estandarizadas con máximo dos selecciones.
- Las definiciones quedan aisladas por organización mediante RLS.
- Una actividad puede recibir su encuesta aun cuando todavía no tiene participantes asignados, para soportar la futura plantilla de programas.
- La encuesta se habilita al colaborador únicamente después de enviar su entrega.
- La entrega aporta 50% del avance de la actividad y la encuesta respondida aporta el 50% restante.
- Si el colaborador abandona el flujo, la encuesta permanece pendiente y vuelve a mostrarse al recargar.
- Una entrega con encuesta pendiente no ingresa a la bandeja de revisión del consultor.
- Las respuestas quedan persistidas por asignación, pregunta y organización, con RLS y auditoría.

## Contrato inicial

- `GET /api/v1/organizations/{organizationId}/programs/{programId}/evaluations`
- `POST /api/v1/organizations/{organizationId}/programs/{programId}/activities/{activityId}/evaluation`
- `POST /api/v1/me/programs/{programId}/activities/{activityId}/survey-response`

Crear por segunda vez una encuesta para la misma actividad devuelve conflicto y nunca reemplaza silenciosamente la definición existente.

## Siguiente incremento

La consulta agregada de resultados y el eventual versionado editable de encuestas se implementarán sobre estas definiciones. Las respuestas conservan la pregunta contestada y no reemplazan silenciosamente una respuesta previamente enviada.
