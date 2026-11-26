# Archivos por participante y programa

## Alcance

El consultor puede cargar y eliminar PDF e imágenes JPG, PNG o WebP desde Colaboradores → Archivos, o desde la nueva sección Archivos del programa. Cada archivo tiene un nombre visible para la persona. Máximo 10 MB por archivo y 10 archivos por inscripción/programa, confirmado el 2026-11-25.

El colaborador consulta y descarga únicamente sus propios archivos desde Mis programas → Programa → Archivos. Líder y RRHH pueden consultar los archivos de las personas del programa desde la sección Archivos, sin permisos de carga ni eliminación. Estos permisos se comprueban también en cada operación de la API, sin URLs públicas ni tokens en enlaces.

Se permite al consultor preparar archivos para personas registradas que aún no aceptan su invitación. Un colaborador no puede ver archivos de un programa sin activar, ni acceder tras suspensión o retiro. Una participación completada conserva consulta. Programas finalizados/cancelados quedan en solo consulta, como el contenido existente.

No se incorporan los cambios de porcentajes ni carga automática del PDF DISC en este incremento. Los archivos permiten nombres repetidos y no sobrescriben versiones; esa base permite incorporar posteriormente los PDF DISC.

## Almacenamiento y consistencia

Migración aditiva V20261125020000: tabla participant_files con organización, programa, inscripción, nombre, MIME detectado, contenido binario, tamaño, autor, fecha y un cupo de 1 a 10. La referencia compuesta a enrollments y RLS mantienen el aislamiento entre organizaciones.

Se reutiliza PostgreSQL, como para las imágenes de respuestas existentes. No se agrega infraestructura. El listado solo lee metadatos; el binario se carga al solicitar vista o descarga. El respaldo completo y su restauración incluyen los archivos. El crecimiento de archivos aumenta el tamaño de la base y de sus copias; revisar almacenamiento antes de ampliar el piloto.

Cargar y eliminar bloquean programa e inscripción en una transacción. El cupo único con rango 1–10 refuerza el límite en la base de datos; eliminar libera su cupo. El registro de auditoría confirma la carga/eliminación después del commit, sin escribir nombres o contenido en logs.

El tipo se determina por el contenido, no por el nombre o MIME del cliente: identificación de imágenes existente y firma/cierre de PDF. No se aceptan SVG, HTML u otros formatos. Esta validación no es un análisis antivirus ni una validación completa de la estructura de PDF. Las respuestas binarias usan MIME concreto, Content-Disposition, no-store y nosniff.

## API

- GET /api/v1/organizations/{org}/programs/{program}/files/participants?page=0&size=20
- GET, POST multipart /api/v1/organizations/{org}/programs/{program}/enrollments/{enrollment}/files
- DELETE .../files/{file}
- GET .../files/{file}/content?download=true
- GET /api/v1/me/programs/{program}/files
- GET /api/v1/me/programs/{program}/files/{file}/content?download=true

POST recibe name y file. Solo un consultor puede mutar. Las descargas requieren autenticación; en el navegador se crean URLs blob locales y se liberan al cerrar la vista. PDF se abre en otra pestaña desde la vista preparada y las imágenes muestran una vista previa.

## Validación manual

1. Reiniciar el backend para aplicar la migración y abrir un programa como consultor.
2. En Colaboradores, abrir Archivos de una persona. Cargar un PDF y una imagen con nombres distintos; verificar listado, vista, descarga y nombre descargado.
3. Entrar como esa persona: ver solamente sus archivos de ese programa. Comprobar en otro programa/persona que no aparecen.
4. Como líder y RRHH, entrar a Archivos y seleccionar una persona: consultar/descargar sin controles de carga ni eliminación.
5. Eliminar un archivo como consultor con confirmación; comprobar que ya no está disponible para el colaborador.
6. Alcanzar diez archivos y comprobar el límite; eliminar uno permite cargar otro. Rechazar un archivo vacío, de formato no permitido o mayor de 10 MB.
7. Suspender o retirar al participante y verificar que las rutas de listado y descarga dejan de permitirle acceder. Reincorporar conserva los archivos.
8. Comprobar consulta desde móvil y que el resto del programa conserva sus datos y comportamiento.
