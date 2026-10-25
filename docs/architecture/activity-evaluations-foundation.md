# Encuestas posteriores a actividades

Fecha: 2026-09-20

## Alcance habilitado

- Cada actividad puede tener una única encuesta.
- El consultor crea la encuesta desde `Contenido`, dentro de la actividad correspondiente.
- La encuesta contiene entre 1 y 20 preguntas ordenadas.
- Tipos disponibles:
  - `AGREEMENT_SCALE`: escala de 1 a 5, desde “Totalmente en desacuerdo” hasta “Totalmente de acuerdo”.
  - `LIKELIHOOD_SCALE`: escala de 1 a 5, desde “Muy improbable” hasta “Muy probable”.
  - `NUMERIC_SCALE`: escala numérica genérica, solo 1, 2, 3, 4 y 5, sin etiquetas asociadas; selección única obligatoria.
  - `OPEN_TEXT`: respuesta abierta.
  - `EMOTION_MULTI_SELECT`: emociones estandarizadas con máximo dos selecciones.
  - `SINGLE_CHOICE_LETTERS`: selección única con opciones editables en lista con letras.
  - `SINGLE_CHOICE_WORDS`: selección única con palabras editables en etiquetas.
    Definición, límites, pruebas y separación del futuro cierre de sesión:
    [catálogo compartido de preguntas](shared-question-catalog.md).
- Las definiciones quedan aisladas por organización mediante RLS.
- Una actividad puede recibir su encuesta aun cuando todavía no tiene participantes asignados, para soportar la futura plantilla de programas.
- La encuesta se habilita al colaborador únicamente después de enviar su entrega.
- La entrega aporta 50% del avance de la actividad y la encuesta respondida aporta el 50% restante.
- Si el colaborador abandona el flujo, la encuesta permanece pendiente y vuelve a mostrarse al recargar.
- Una entrega con encuesta pendiente no ingresa a la bandeja de revisión del consultor.
- Las respuestas quedan persistidas por asignación, pregunta y organización, con RLS y auditoría.
- La escala numérica tiene distribución y media por pregunta en resultados y
  exportaciones. No se mezcla con las medias globales de acuerdo o probabilidad,
  porque su significado lo define cada enunciado. Se conserva al duplicar
  actividades y crear programas desde plantillas. `V20261023020000` amplía la
  restricción de tipos sin modificar preguntas ni respuestas existentes.

## Contrato inicial

- `GET /api/v1/organizations/{organizationId}/programs/{programId}/evaluations`
- `POST /api/v1/organizations/{organizationId}/programs/{programId}/activities/{activityId}/evaluation`
- `POST /api/v1/me/programs/{programId}/activities/{activityId}/survey-response`

Crear por segunda vez una encuesta para la misma actividad devuelve conflicto y nunca reemplaza silenciosamente la definición existente.

## Resultados y edición posteriores

La [consulta agregada y exportación de resultados](activity-survey-results.md)
está implementada localmente el 2026-10-19, con commit y push autorizados por el
usuario. Incluye filtros por dimensión/sesión/actividad, distribuciones,
medias separadas por escala, emociones, textos abiertos y CSV.

La [administración de contenido](program-content-administration.md) permite
corregir encuestas solo antes de la primera entrega. El versionado histórico de
encuestas ya respondidas sigue pendiente: las respuestas conservan la pregunta
contestada y nunca se reemplazan silenciosamente.
