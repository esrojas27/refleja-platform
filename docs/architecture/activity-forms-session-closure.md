# Formularios de actividad y cierre de sesión · incremento 2

## Decisiones aprobadas

El formulario es la entrega de la actividad. Ya no existe una entrega de texto
libre seguida de una encuesta posterior. Una pregunta abierta sigue siendo un
tipo disponible dentro del formulario. Actividades y cierres comparten el catálogo,
editor, validación y componentes de respuesta, incluidos los nuevos tipos de
selección única. Las plantillas independientes de formularios quedan para el
incremento 3.

Cada sesión tiene un comentario y una encuesta de cierre. El comentario se
configura al crear/editar la sesión, en lugar del objetivo. Su confirmación se
guarda por inscripción/sesión: se muestra una sola vez, después de enviar todas
las actividades, sin exigir aprobación del consultor. Luego se presenta la
encuesta de cierre pendiente hasta enviarla. No se envían correos adicionales.

Las actividades aportan, en partes iguales, el 80% de la sesión. La encuesta de
cierre aporta el 20% restante. Por ejemplo, dos actividades corresponden a 40%
cada una y el cierre a 20%. El progreso del programa promedia las sesiones; la
aprobación del consultor sigue siendo una medida distinta.

## Preparación, agenda y correcciones

- Antes de agendar se exige al menos una actividad, un formulario en cada
  actividad, comentario de cierre y encuesta de cierre. La agenda indica el
  primer requisito pendiente y deshabilita la acción; el servidor también lo exige.
- Se conserva la agenda individual: al asignar fecha se asignan las actividades,
  son visibles de inmediato y vencen tres días calendario después de esa fecha.
- Solo una solicitud del consultor habilita corregir un formulario enviado. La
  entrega incluye la versión de la asignación; una versión desactualizada falla
  sin sobrescribir respuestas. Antes de reemplazarlas se guarda la versión anterior.
- Una corrección pendiente descuenta el aporte de esa actividad. Si el comentario
  ya se había confirmado, no vuelve a mostrarse al reenviar la actividad.
- Una vez completada la sesión al 100%, no se permiten correcciones para esa
  persona. El consultor puede aprobar la entrega sin reabrir el cierre.
- Una sesión con algún cierre completado no admite actividades nuevas, duplicadas
  ni restauradas. Evita cambiar el denominador del progreso ya completado.
- Comentario y encuesta de cierre quedan protegidos desde la primera confirmación
  del comentario. Los formularios de actividad conservan el bloqueo tras la
  primera entrega. Programas e inscripciones de solo consulta no aceptan envíos.

## Persistencia y contratos

La migración `V20261025020000__activity_forms_and_session_closure.sql` reutiliza
las tablas de definiciones, preguntas y respuestas con pertenencia excluyente a
actividad o sesión. Añade confirmaciones de cierre y versiones históricas de
respuestas con RLS por organización; el rol de aplicación solo puede leer e
insertar en esas dos tablas. Las escrituras bloquean el programa y se ejecutan
atómicamente; ningún estado ni respuesta se publica antes de confirmar la transacción.

- `POST /me/programs/{program}/activities/{activity}/submission` recibe
  `{version, answers:[{questionId,values}]}`. Se eliminó `/survey-response`.
- Configuración del consultor: `GET /organizations/{org}/programs/{program}/session-surveys`
  y `POST /organizations/{org}/programs/{program}/sessions/{session}/survey`.
- Colaborador: `GET /me/programs/{program}/session-closures`,
  `POST /me/programs/{program}/sessions/{session}/closure-acknowledgement`
  y `POST /me/programs/{program}/sessions/{session}/closure-response`.
- Los contratos de creación, edición y estructura usan `closingComment`. La
  columna interna `program_sessions.objective` conserva el almacenamiento; no se
  reutiliza automáticamente una descripción antigua como comentario.

Esta migración no limpia datos ni usuarios. El texto libre histórico se conserva
en base de datos, pero ya no es un medio de entrega ni se muestra como formulario.
No se convierten datos de prueba antiguos ni se habilita el contrato anterior.
Las plantillas de programa nuevas copian el comentario y ambos tipos de
formularios con identificadores independientes, sin respuestas, agenda o progreso.
Una plantilla antigua sin cierre no se puede materializar con este contrato.

Los resultados existentes siguen identificados como respuestas de actividades;
no se mezclan con los cierres. El informe interpretado individual y las métricas
de empresa basadas en cierres corresponden al incremento de análisis posterior.

## Validación manual

1. Reiniciar la API local para aplicar la migración y la web para cargar el nuevo
   contrato. No repetir limpiezas de datos ni restaurar el conjunto antiguo.
2. Como consultor, crear programa, dimensión y sesión con comentario de cierre.
   Intentar agendar antes de completar su contenido: debe indicar lo que falta.
3. Crear dos actividades. En cada una crear su formulario; probar pregunta abierta,
   escala, emociones y selección única. Crear la encuesta de cierre desde la sesión.
4. Inscribir al colaborador, aceptar invitación y completar perfil. Activar el
   programa y asignarle fecha. Debe ver inmediatamente sus dos actividades.
5. Enviar la primera: 40% de sesión. No debe aparecer una segunda encuesta para
   esa actividad. Enviar la segunda: 80% y popup con el comentario configurado.
6. Cerrar el popup, salir sin responder y regresar: debe aparecer la encuesta
   pendiente, sin repetir el popup. Enviarla: sesión al 100%, respuestas consultables
   y sin indicador de cierre pendiente en el menú.
7. Con otra sesión sin completar, solicitar una corrección como consultor: verificar
   respuestas precargadas, edición y reenvío. La confirmación del popup no se repite.
8. Tras el 100%, verificar que no se puede solicitar cambios ni crear/duplicar una
   actividad en esa sesión. Aprobar la entrega sí debe seguir siendo posible.
9. Crear una plantilla del programa y usarla en un programa nuevo. Debe incluir
   formularios de actividades, comentario y encuesta de sesión, pero no participantes,
   respuestas ni fechas individuales.
10. Revisar los pasos 4–6 en escritorio y móvil. Una inscripción suspendida/retirada
    no puede acceder; una completada conserva solo consulta.

La validación local no implica despliegue en DEV. El usuario validó el incremento 2
y autorizó su commit/push el 2026-10-25; la publicación requiere los checks y el
despliegue correspondientes.

## Verificaciones locales

- Backend: `mvn verify`, 336 pruebas, sin fallos ni omisiones; PostgreSQL 18
  desechable, validación JPA, arquitectura modular y migraciones incluidas.
- Frontend: 331 pruebas completas; comprobación de tipos y lint sin errores.
- Compilación de producción de Next.js correcta. Se mantiene la advertencia
  preexistente sobre `metadataBase`, no relacionada con este incremento.
- Chromium a 1440 y 375 px: popup, transición a encuesta y cierre al 100%,
  sin errores de página ni desbordamiento horizontal. Componentes reales con
  respuestas sintéticas y sin conexiones a AWS.
- No se repitió el recorrido real de Cognito contra DEV para este incremento.
  Los flujos nuevos se probaron con integración HTTP/base de datos y componentes;
  la validación funcional local del usuario fue completada y aprobada.
