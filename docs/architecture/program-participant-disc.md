# Ficha DISC porcentual y versiones del PDF

## Alcance y permisos

La ficha de cada colaborador contiene cuatro porcentajes enteros independientes de 0 a 100: D (Dominante), I (Influyente), S (Sereno) y C (Concienzudo). No se normalizan, no deben sumar 100 y no se calculan a partir de respuestas.

Solo el consultor puede editar porcentajes o cargar PDF. Líder y RRHH pueden consultar fichas si tienen membresía activa e inscripción activa o completada en ese programa. Suspensión/retiro bloquean su acceso. El colaborador puede consultar exclusivamente su propia ficha, en modo lectura, cuando el consultor haya definido los cuatro porcentajes. En ese momento aparece DISC en su espacio del programa, con el mismo radar y sus versiones de PDF. Los documentos continúan disponibles también mediante Archivos.

El consultor puede preparar porcentajes y PDF para colaboradores con inscripción INVITED, además de ACTIVE/COMPLETED. No se exige haber enviado ni aceptado la invitación: una invitación en borrador también permite preparar la ficha. En INVITED se utiliza el rol COLLABORATOR de la invitación, aunque una cuenta existente todavía no tenga asignado ese rol. No se incluyen invitaciones revocadas, otros roles ni inscripciones suspendidas, retiradas o pendientes de aprobación. Líder y RRHH mantienen su consulta de colaboradores activos/completados.

Guardar DISC no envía invitaciones ni activa cuentas o inscripciones. La ficha y los archivos pertenecen a la inscripción original y se conservan al aceptar la invitación. Solo entonces, con el perfil completo y el programa activado, el colaborador puede consultarlos. Una cuenta ya activa en otro programa tampoco puede leer el DISC de una invitación todavía no aceptada. La vista del consultor identifica estas personas con «Invitación pendiente de aceptación».

El programa finalizado/cancelado conserva consulta y bloquea edición y cargas. La API resuelve permisos en cada operación, usa RLS y exige la última versión optimista para modificar una ficha.

## Radar

La ficha usa un radar de cuatro ejes: D arriba, I a la derecha, S abajo y C a la izquierda. El centro es 0 y el anillo exterior 100. Cinco anillos representan 20, 40, 60, 80 y 100. Un polígono conecta los cuatro valores cuando todos están completos.

La vista previa cambia mientras se editan los campos. Los datos faltantes no se representan como cero ni forman un polígono completo. La gráfica incluye nombres y valores en texto, descripción accesible y una leyenda legible en móvil. Es una visualización de valores registrados, sin interpretación automática ni diagnóstico.

## Datos existentes y auditoría

La migración V20261125030000 agrega columnas INTEGER de porcentajes a las fichas y sus revisiones. Conserva los textos y revisiones anteriores. Una ficha cualitativa sin porcentajes se marca needsUpdate, aparece pendiente y requiere captura explícita; no se convierte texto a números.

Las modificaciones guardan una revisión numérica con el actor y la versión. Guardar los mismos valores con la versión vigente es una operación sin cambios, sin duplicar la revisión. Un cliente desactualizado recibe 409. El historial continúa sin permisos de UPDATE/DELETE para rti_app.

## Consulta personal del colaborador

GET /api/v1/me/programs/{program}/disc-profile resuelve la persona desde el Access Token, sin aceptar un enrollmentId elegido por el cliente. Solo permite una membresía activa de colaborador con inscripción ACTIVE/COMPLETED en un programa que haya sido activado. Suspensión o retiro impiden la consulta.

Devuelve profile null cuando no hay ficha numérica completa, incluida una ficha cualitativa anterior; cuatro valores cero constituyen una ficha completa. Nunca devuelve fichas, identidades ni documentos de otros participantes. No habilita edición en las rutas personales ni acceso al listado administrativo.

La navegación comprueba la disponibilidad al cargar, cambiar de ruta y volver a la pestaña. Un fallo en esta consulta no interrumpe el listado de actividades. La página personal /my-programs/{program}/disc consulta sus PDF por las rutas autenticadas existentes /me/programs/{program}/files, filtradas por documentType DISC.

## PDF y archivos

POST /api/v1/organizations/{org}/programs/{program}/disc-profiles/{enrollment}/pdf recibe únicamente file. Valida un PDF de hasta 10 MB. Puede cargarse antes o después de registrar los porcentajes; no altera sus valores ni su versión optimista.

El PDF queda en participant_files con título DISC, documentType DISC y documentVersion asignada por el servidor. Cada carga crea otro archivo: no reemplaza anteriores. El contador por inscripción/programa sobrevive a eliminaciones y no reutiliza números. El nombre descargado incluye la versión, por ejemplo DISC-v2.pdf.

Los documentos se muestran tanto en la sección DISC como en Archivos. Consultor puede eliminarlos con confirmación; las versiones conservadas siguen disponibles. Cada PDF cuenta dentro del límite conjunto de 10 archivos por persona/programa. Alcanzar el límite no sobrescribe ni elimina documentos automáticamente.

Los archivos anteriores se conservan sin inferir su tipo o numeración a partir del nombre. Todo sigue incluido en el respaldo de PostgreSQL; no se añade infraestructura ni se envían correos.

## Validación manual

1. Reiniciar el backend y abrir DISC como consultor. Completar una ficha con D=80, I=65, S=30, C=45 y comprobar el radar durante la edición.
2. Probar 0, 100, un decimal, un número negativo y uno mayor de 100. Solo admitir enteros dentro del rango, sin exigir suma 100.
3. Guardar y volver a abrir: conservar valores. Guardar sin cambios debe funcionar.
4. Cargar dos PDF distintos: ver versiones 1 y 2, ambas en Archivos con el nombre DISC. Descargar y comprobar cada contenido y nombre.
5. Eliminar la versión 2 con confirmación y cargar otra: debe ser versión 3, con la 1 intacta.
6. Como líder y RRHH inscritos, consultar radar y PDF sin formularios de edición/carga ni eliminación.
7. Como colaborador, comprobar que DISC aparezca solo tras registrar los cuatro porcentajes (también si son cero). Consultar su radar y sus versiones de PDF sin controles de edición, carga o eliminación. Verificar que no accede a fichas o PDF ajenos.
8. Comprobar el límite conjunto de diez archivos, el programa cerrado y el acceso tras suspensión/retiro.
9. Registrar otro colaborador sin enviar su invitación. Abrir DISC como consultor: debe aparecer, permitir guardar los cuatro porcentajes y cargar un PDF, y seguir con invitación pendiente. Tras enviar y aceptar la invitación y completar el perfil, comprobar como colaborador el mismo radar y el mismo PDF, sin volver a cargarlos.
