# Plantillas globales de formularios · incremento 3

## Alcance confirmado

El usuario confirmó que el catálogo se comparte entre organizaciones y está
disponible exclusivamente para consultores, igual que las plantillas de programas.
Una plantilla sirve tanto para el formulario de una actividad como para la
encuesta de cierre de una sesión, sin distinguir el tipo de origen.

Se puede guardar una plantilla desde cualquier definición ya creada, incluso
si tiene respuestas o pertenece a un programa cerrado. Esta operación solo lee
el origen: no modifica sus preguntas, participantes, entregas ni progreso.

Cada plantilla es una copia independiente e inmutable de título, indicaciones,
preguntas, tipos, opciones y orden. No incluye identificadores de preguntas,
respuestas, personas, agenda ni progreso. El nombre es único en el catálogo
global, sin distinguir mayúsculas y minúsculas. No se implementan edición o
eliminación de plantillas en este incremento: para otra versión se guarda una
nueva plantilla con otro nombre.

## Experiencia del consultor

- En Contenido, las actividades con formulario y las sesiones con encuesta de
  cierre muestran **Guardar como plantilla**.
- El modal solicita nombre y descripción opcional. Avisa que se compartirá con
  consultores de todas las organizaciones y pide revisar que la definición no
  incluya datos personales/confidenciales. Permite revisar las preguntas.
- En ambos editores aparece **Usar plantilla**. Abre un catálogo paginado dentro
  del editor, con nombre, descripción y cantidad de preguntas.
- **Ver plantilla** muestra el título, indicaciones, preguntas, tipos y opciones.
  **Usar esta plantilla** reemplaza el borrador, previa advertencia visible.
- Cargar una plantilla no guarda el formulario. El consultor puede cambiar el
  título, las indicaciones, las preguntas, las opciones y el orden antes de guardar.
- Guardar usa los mismos endpoints y validaciones de formularios existentes:
  genera nuevas preguntas y mantiene los bloqueos por entregas/cierre iniciado.
  Una plantilla no permite saltarse esas restricciones.

El selector es un panel dentro del modal del editor, no un segundo modal anidado;
cerrarlo no descarta el formulario que se estaba editando.

## Implementación y permisos

`V20261025030000__global_questionnaire_templates.sql` crea
`rti.questionnaire_templates`. Guarda la procedencia solo para trazabilidad
interna y una definición JSONB independiente. El identificador de la evaluación
de origen no tiene FK: eliminar una actividad sin asignaciones no invalida la
plantilla ya guardada.

La tabla tiene RLS: lectura global para el rol de aplicación e inserción solo
desde el contexto de la organización de origen. El rol `rti_app` no tiene permisos
de UPDATE/DELETE. Todas las rutas de producto exigen autenticación y rol
CONSULTANT en la organización del contexto. Colaborador, Líder y RRHH no pueden
listar, leer ni crear plantillas. La definición de origen siempre la obtiene el
servidor desde un programa autorizado; el cliente no puede publicar un snapshot
arbitrario mediante el endpoint de plantillas.

Contratos, bajo `/api/v1`:

- `GET /organizations/{org}/questionnaire-templates?page=0&size=20`: metadatos
  paginados, máximo 100 por página, orden estable por creación e identificador.
- `GET /organizations/{org}/questionnaire-templates/{id}`: metadatos y definición.
- `POST /organizations/{org}/questionnaire-templates`: `sourceProgramId`,
  `sourceEvaluationId`, `name` y `description` opcional. Devuelve 201 y referencia
  de solicitud; la creación se registra en auditoría tras confirmar la transacción.

No se incluyen procedencia interna ni datos de autor en los resultados públicos
del catálogo. No hay nuevos envíos de correo ni servicios de infraestructura.
La migración no elimina ni convierte datos existentes.

## Validación manual local

1. Reiniciar API/web para aplicar la migración y cargar los controles nuevos.
2. Como consultor, abrir Contenido y guardar como plantilla el formulario de una
   actividad. Verificar el aviso de alcance global, nombre obligatorio y revisión
   de preguntas. Probar un nombre ya utilizado: debe pedir uno diferente.
3. Crear una encuesta de cierre de sesión, abrir Usar plantilla, revisar la copia
   y cargarla. Modificar una pregunta y guardar; recargar y comprobar la adaptación.
4. Guardar como plantilla una encuesta de cierre y utilizarla en una actividad
   nueva. Probar escalas, pregunta abierta, emociones y selección única con sus
   opciones, incluidos un listado largo de palabras y el orden de preguntas.
5. En otra organización, con perfil consultor, comprobar que aparece el mismo
   catálogo. Usar la plantilla allí: las respuestas del origen no deben aparecer.
6. Modificar una definición de origen editable y volver a consultar la plantilla:
   debe conservar la copia anterior. Cambiar el formulario nuevo tampoco modifica
   la plantilla ni otros programas creados desde ella.
7. Abrir el catálogo y cerrarlo sin usar la plantilla: el borrador anterior debe
   permanecer intacto. Usarla tampoco debe guardar hasta pulsar Crear/Guardar.
8. Comprobar como colaborador que no aparecen estas acciones y que no puede
   consultar las rutas del catálogo. Con una actividad respondida/cierre iniciado,
   verificar que la plantilla no habilita reemplazar preguntas protegidas.
9. Repetir guardado, vista previa y carga en escritorio y móvil.

El usuario validó el incremento 3, incluida la corrección de foco del modal, y
autorizó su commit/push el 2026-10-25. La publicación en DEV requiere los checks y
el despliegue correspondientes.

## Verificaciones

- Backend: `mvn verify`, 344 pruebas, sin fallos ni omisiones. Incluye PostgreSQL
  18 desechable, migración, permisos del catálogo, reutilización cross-org en ambos
  sentidos, inmutabilidad y exclusión de respuestas e identificadores del origen.
- Frontend: 346 pruebas completas, comprobación de tipos y lint correctos.
- Compilación de producción de Next.js correcta; persiste la advertencia previa
  de `metadataBase`, fuera del alcance de este incremento.
- Chromium a 1440 y 375 px: guardado global, vista previa y carga del borrador con
  30 opciones de palabras; sin errores de página ni desbordamiento horizontal.
  Los componentes son reales y el catálogo de esta prueba visual usa datos
  sintéticos; no se hicieron llamadas a AWS ni se enviaron correos.
- Corrección de foco: el modal enfoca su contenedor únicamente al abrirse, no
  al cambiar el manejador de cierre durante la edición. La prueba de regresión
  reproduce el fallo original y comprueba cada carácter en nombre y descripción.
  Chromium también verificó escritura continua en ambos campos a 1440 y 375 px;
  Escape conserva el manejador más reciente y el bloqueo de scroll se restaura
  al cerrar el modal.
- No se modificaron datos locales/de DEV ni usuarios para estas pruebas. La
  nueva migración se aplicará a esos entornos al arrancar/desplegar la API.
