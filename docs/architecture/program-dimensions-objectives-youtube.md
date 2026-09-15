# Dimensiones, objetivos de sesión y videos de actividad

## Decisión funcional

La estructura visible del producto es **Programa → Dimensión → Sesión →
Actividad**. Las dimensiones son configurables. Interior, Exterior y Social no
son valores obligatorios ni registros automáticos: serán el contenido inicial
modificable de una futura plantilla, fuera del alcance de este incremento.

Las sesiones presentan un **objetivo** opcional en lugar de una descripción. Las
actividades pueden conservar un enlace opcional a un video de YouTube.

## Compatibilidad

ADR-005 exige estabilidad dentro de `/api/v1`. Por ello se mantienen las rutas
`/modules`, el parámetro `{moduleId}`, el campo `moduleId` y las tablas físicas
existentes. El frontend adapta ese contrato al término `dimensionId` sin exponer
la terminología anterior. No se agregó una segunda API equivalente.

`objective` es un campo aditivo. Las respuestas de sesión conservan
temporalmente `description` y agregan `objective`; las solicitudes antiguas que
envían sólo `description` siguen funcionando. La migración copia las
descripciones existentes a `objective`.

## Enlaces de YouTube

`youtubeUrl` es opcional y se limita a 2048 caracteres. Backend y PostgreSQL
aceptan únicamente HTTPS y formatos de video de `youtube.com`, `youtu.be` y
`youtube-nocookie.com`; no aceptan credenciales, puertos, HTML ni código de
inserción. El frontend repite esta validación para dar respuesta inmediata, pero
la regla autoritativa permanece en el backend y en la restricción de datos.

El video se abre por ahora en una pestaña nueva con protección
`noopener noreferrer`. No se implementan iframe, extracción de metadatos,
miniaturas ni llamadas a una API de YouTube.

## Persistencia

`V20260914050000__add_session_objective_and_activity_youtube_url.sql` agrega:

- `rti.program_sessions.objective TEXT`, nullable y limitado a 10.000 caracteres;
- `rti.program_activities.youtube_url VARCHAR(2048)`, nullable y restringido a
  formatos HTTPS aprobados.

No se crean plantillas, dimensiones predeterminadas ni datos de negocio en la
migración.

## Validación manual

1. Como consultor, abrir el contenido de un programa y crear una dimensión con
   un nombre libre distinto de Interior, Exterior o Social.
2. Crear una sesión con objetivo y confirmar que se muestra y persiste al recargar.
3. Crear una actividad con una URL válida de YouTube y comprobar que el enlace se
   muestra tanto al consultor como al colaborador asignado.
4. Intentar crear otra actividad con HTTP o un dominio distinto de YouTube y
   comprobar que el formulario la rechaza.
5. Confirmar que no aparecieron dimensiones automáticas ni controles de plantilla.
