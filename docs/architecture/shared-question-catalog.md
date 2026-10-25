# Incremento 1: catálogo compartido y selección única

> Documento histórico del incremento 1. El flujo 50/50 descrito aquí fue sustituido
> por [formularios de actividad y cierre de sesión](activity-forms-session-closure.md)
> en el incremento 2; usar ese documento para la validación actual.

Fecha: 2026-10-25. Implementación validada por el usuario y autorizada para
commit/push. La disponibilidad en DEV depende del pipeline y despliegue exitosos,
no de esta validación local.

## Alcance

Se incorporan al editor de encuestas dos tipos de pregunta:

- `SINGLE_CHOICE_LETTERS`: opciones editables en una lista con letras a, b, c…;
  después de z continúa aa, ab… No está limitado a cuatro respuestas posibles.
- `SINGLE_CHOICE_WORDS`: opciones editables en etiquetas seleccionables, adecuadas
  para preguntas con unas treinta palabras. Solo se puede seleccionar una, a
  diferencia de `EMOTION_MULTI_SELECT`, que conserva su máximo de dos emociones.

El consultor escribe o pega una opción por línea y dispone de vista previa.
Los límites técnicos son 2–100 opciones de 1–200 caracteres. Se recortan espacios
en los extremos, se omiten líneas vacías del editor y se rechazan duplicados sin
distinguir mayúsculas. El API rechaza entradas vacías o nulas. El orden de opciones
es el escrito; las preguntas siguen pudiendo reordenarse con las flechas.

## Reutilización

- Frontend: `lib/forms/question-catalog.ts`, `components/forms/survey-question-input.tsx`
  y `single-choice-options.tsx` no dependen del envío de una actividad concreta.
- Backend: `QuestionOptions` y `QuestionAnswers` comparten reglas de definición y
  respuesta independientemente de si el futuro formulario pertenece a actividad
  o sesión. El transporte actual de actividad utiliza estas mismas reglas.
- Las opciones se conservan al crear/editar, recargar, duplicar una actividad y
  materializar una plantilla de programa, incluso entre organizaciones autorizadas.
- La encuesta de cierre de sesión y su editor se conectarán en el incremento 2;
  todavía no existe esa nueva pantalla ni un endpoint de cierre en este incremento.

## Persistencia, respuestas y resultados

`V20261025010000__add_custom_single_choice_questions.sql` amplía el catálogo y
agrega `options TEXT[]` a cada pregunta. Mantiene RLS y permisos existentes,
conserva los datos anteriores y añade restricciones de cantidad, longitud,
unicidad y correspondencia entre tipo y opciones. No hay reset de datos en la
migración; la limpieza autorizada anterior fue una operación independiente.

Las respuestas nuevas guardan la etiqueta elegida, no su letra ni un índice
numérico. El servidor exige exactamente un valor que pertenezca a esa pregunta;
rechaza respuestas ajenas, vacías, múltiples o con IDs de preguntas diferentes.
La definición conserva el bloqueo existente después de la primera entrega.

Las opciones aparecen en resultados y CSV/Excel en su orden original, con conteo
y porcentaje por opción. No tienen promedio y no se suman a medias de escalas.
No cambia la autorización: resultados/exportaciones siguen siendo del consultor.
La separación futura entre informe individual y métricas de empresa sigue pendiente.

## Qué no cambia todavía

El flujo actual sigue siendo entrega de actividad y luego su encuesta; conserva
su cálculo actual 50/50. Convertir el formulario en la propia entrega, reemplazar
el objetivo por comentario de cierre, mostrar el popup y aplicar 80/20 a la sesión
corresponde al incremento 2. Tampoco se implementan aquí las plantillas de
formularios, el nuevo correo, la guía, el dominio o los informes interpretados.

## Validación manual local

1. Arrancar la aplicación con `dev.cmd`; Flyway aplicará la migración nueva al
   iniciar la API. No restaurar los datos eliminados ni repetir la limpieza.
2. Como consultor, crear un programa, dimensión, sesión y actividad. Abrir la
   creación de encuesta desde esa actividad.
3. Crear una pregunta de lista con letras con dos opciones; probar también seis.
   Crear otra de palabras pegando treinta opciones, una por línea.
4. Guardar, recargar y editar: comprobar textos, tipos y orden. Mover una pregunta
   con las flechas, guardar y comprobar que conserva sus opciones.
5. Intentar guardar una sola opción o dos iguales: debe mostrarse el error junto
   al editor de opciones, sin enviar una definición inválida.
6. Inscribir a un colaborador, aceptar su invitación, completar su perfil si falta,
   activar el programa y agendar su sesión. Usar el flujo actual para enviar la actividad.
   En su encuesta, elegir una opción y después otra: solo la última queda marcada.
   Intentar enviar sin seleccionar y comprobar el aviso de obligatoriedad.
7. Revisar resultados y CSV/Excel: etiquetas completas y conteos, sin promedios de
   selección única. Duplicar una actividad o crear un programa desde plantilla y
   comprobar que conserva las opciones y no copia respuestas.
8. Revisar escritorio y móvil, navegación con Tab/flechas y visibilidad de la
   selección. La prueba visual automatizada usó componentes reales con datos
   sintéticos, no credenciales reales ni solicitudes a AWS.

En DEV estos pasos aplicarán después del commit/push autorizado y del despliegue
exitoso de este incremento, no por la validación local ni por la limpieza anterior.

## Verificaciones ejecutadas

- Backend: `mvn verify`, **332 pruebas**, sin fallos ni omisiones; PostgreSQL 18
  desechable de Testcontainers, migraciones y validación JPA incluidas.
- Frontend: suite completa de **317 pruebas**; tipos y lint correctos.
- `next build`: compilación de producción correcta. Mantiene la advertencia
  preexistente de `metadataBase` para imágenes de metadatos, fuera de este alcance.
- Prueba visual en Chromium a 1440 y 375 px: sin errores de página ni
  desbordamiento horizontal, una sola selección y funcionamiento con teclado.
- Durante estas verificaciones locales no se repitió el E2E real con Cognito,
  no se enviaron correos ni se modificaron usuarios o datos de DEV.
