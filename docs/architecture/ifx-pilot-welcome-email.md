# Bienvenida del piloto IFX / Coach Ejecutivo

## Alcance aprobado el 2026-10-25

El usuario aprobó la guía revisada de seis páginas y decidió compartirla por
Drive, no como adjunto. El enlace es:

https://drive.google.com/file/d/1kky3u0KHF4fN1g1DALHx6wT2Nexi-pVA/view?usp=sharing

Una consulta HTTP sin cookies ni credenciales devolvió 200, con título
`Guia_del_colaborador_Refleja_IFX.pdf - Google Drive`, sin solicitud de acceso.
La disponibilidad y los permisos del archivo siguen siendo responsabilidad del
propietario de Drive. Se recomienda probarlo también en incógnito y actualizar
el mismo archivo mediante «Gestionar versiones», sin reemplazar su identificador.

## Decisión temporal: contenido fijo del piloto

El programa aún no está creado. El usuario indicó dejar el contenido estático
por ahora y parametrizarlo después. Por tanto, **todas las invitaciones de rol
Colaborador usan temporalmente el mensaje del piloto**: Coach Ejecutivo, el
enlace de esta guía y el plazo editorial del 30 de octubre de 2026. No hay una
selección automática por organización/programa ni se atribuyen identificadores
inexistentes. No utilizar este mensaje para otra empresa/cohorte sin adaptarlo.

Ese plazo no cambia la caducidad técnica de las invitaciones, los permisos,
la aceptación ni las fechas del programa. No se usa `expiresAt` como fecha
editorial. Debe revisarse el texto antes de nuevos envíos después del piloto.

Se conserva el nombre real del destinatario y la URL de acceso por entorno,
calculada desde `INVITATIONS_WEB_BASE_URL` + `/invitations`, no desde una URL
de DEV fija. El remitente sigue siendo el de `INVITATIONS_SES_FROM`.

## Mensaje

- Asunto: «Tu espacio en Refleja Tu Interior ya está disponible».
- Texto final aprobado, con los cinco beneficios y pasos de ingreso.
- La guía se abre con «VER GUÍA DEL COLABORADOR», usando `target="_blank"` y
  `rel="noopener noreferrer"` para solicitar una pestaña nueva sin acceso a la
  ventana de origen. El cliente de correo controla la apertura final de enlaces.
  No se afirma que haya adjunto.
- Botón independiente «CREAR MI USUARIO», usando el mismo correo invitado.
- Contacto: `marcayconexion@paularojas.com.co`.
- Firma y lema aprobados; colores negro, blanco, rosa niebla, rosa y grafito.
- Versiones HTML y texto plano; nombre personalizado escapado en HTML.

`CollaboratorWelcomeEmail` contiene únicamente la presentación. No descarga el
PDF, no llama a Drive, no requiere un token de Google y no cambia permisos de
compartición. No se agregan almacenamiento, secretos, librerías ni recursos AWS.

Las invitaciones de Líder/RRHH conservan su contenido anterior. Cognito sigue
administrando las credenciales iniciales por separado. Registrar una persona no
envía el correo: se conservan el envío explícito por lote, la omisión de enviados,
el reintento individual y la distinción entre fallo y aceptación por SES. `SENT`
no garantiza entrega en inbox ni lectura.

## Validación

Las pruebas capturan solicitudes de un cliente SES simulado; no envían correos.
Comprueban personalización, escape HTML, ambos enlaces, ausencia de adjuntos,
fecha editorial independiente de caducidad, texto alternativo, beneficios,
remitente/destinatario, URLs local/DEV/dominio futuro, contenido de Líder/RRHH y
rechazo de una respuesta del proveedor sin `messageId`.

Verificación local completada: `mvn verify`, 348 pruebas sin fallos, errores ni
omisiones, con PostgreSQL 18 desechable; compilación y empaquetado correctos.
Chromium verificó la vista previa a 320, 375, 768 y 1440 píxeles, sin errores
de página ni desbordamiento horizontal y con los tres enlaces esperados.
Se inspeccionaron las capturas de móvil y escritorio. No se modificaron datos
reales ni se enviaron correos. No se ha publicado este incremento en DEV.

`WelcomeEmailPreview` (fuentes de test) genera una vista HTML/texto desde el
mismo renderizador, con nombre ficticio y sin inicializar clientes AWS. Tras
compilar las pruebas puede ejecutarse con `target/classes;target/test-classes`
como classpath en Windows (usar `:` en Linux) y un directorio de salida.

El usuario validó el incremento localmente, incluida la apertura de la guía,
y autorizó su commit y push el 2026-10-25. La publicación en DEV requiere que
terminen correctamente CI y el despliegue automático; el push por sí solo no
confirma que la nueva versión esté desplegada.

Después del despliegue, el consultor podrá enviar deliberadamente una invitación a un destinatario que
haya consentido recibirla y revisar guía, credenciales, spam y aceptación. Las
pruebas automáticas no sustituyen la revisión en clientes reales de correo.
