# Dominio propio: reflejati.com

## Configuración del 2026-10-25

El usuario compró `reflejati.com` en Hostinger y cambió el A de `@` a la Elastic
IP de DEV `18.210.172.252`, TTL 300. El CNAME `www` apunta al dominio raíz.
Se conservaron los nameservers de Hostinger: no se crea una zona Route 53,
balanceador, servidor, certificado pagado ni otro servicio de correo.

URL canónica: `https://reflejati.com`. Es el mismo ambiente DEV, con sus datos,
límites y horario de disponibilidad, no una nueva infraestructura de producción.

## Cambios coordinados

- Terraform de Cognito: una actualización in-place del app client existente;
  incorpora `/account` y `/login` del dominio nuevo y conserva las URLs de
  localhost y nip.io. La redirección predeterminada pasa a `/account` del dominio
  nuevo. No cambian pool, usuarios, ID del cliente, flujos ni remitente.
- Plataforma: `dev_hostname = "reflejati.com"`, con DNS externo. Se aplicó solo
  un plan `refresh-only` para actualizar estado/salidas, sin acciones sobre los
  recursos. El plan normal mostraba diferencias previas de horario y SNS;
  deliberadamente no se aplicó.
- Variables públicas del environment `development` de GitHub:
  - `RTI_DEV_HOSTNAME=reflejati.com`
  - `RTI_DEV_PUBLIC_URL=https://reflejati.com`
  - `RTI_DEV_REDIRECT_HOSTNAMES=www.reflejati.com,rti-dev.18-210-172-252.nip.io`
- El workflow valida nombres/origen antes de obtener credenciales AWS y forma
  las direcciones de Caddy con coma y espacio. Recompila la web ARM64 nativa con
  API/callback/logout nuevos y alinea CORS y el enlace de invitaciones de la API.
- Caddy sirve los tres nombres con HTTPS automático y certificados persistidos
  en el volumen existente. `www` y nip.io redirigen temporalmente con 302 al
  dominio canónico conservando rutas y parámetros normales, incluidos los
  enlaces de invitaciones enviados antes de la migración.
- `/account` en un alias redirige a `/login` sin parámetros: no se reenvían códigos
  OAuth ni estado PKCE entre orígenes. El cambio de dominio requiere volver a
  iniciar sesión. No se trasladan cookies ni tokens del dominio anterior.
- No cambian el remitente `marcayconexion@paularojas.com.co`, SES ni el enlace
  público de la guía de Drive. El login administrado de Cognito conserva su
  dominio AWS; no se ha implementado una nueva interfaz de login.

## Verificación y reversión

28 pruebas locales de scripts correctas, incluido Caddy 2.10.2 real con
contenedores desechables: configuración local y HTTPS, redirecciones,
conservación de rutas/parámetros y descarte de callbacks antiguos. No se emiten
certificados ni se contacta a los dominios públicos en esa prueba. El gate de
contenedores ejecuta también esta prueba en ARM64 nativo.

Compose conserva cuatro servicios, puertos externos solo en Caddy y límites
combinados de 1.408 MiB. YAML y comprobación de diff correctos.

SSM `50dec80b-4f8c-4e48-a820-827c84e8a591` guardó una copia privada, con modo
0600, del runtime previo en el mismo volumen cifrado. No se imprimieron secretos.
Release anterior: `c84d290d6b1f9dc763edc80ec139d6a265b46b93`; configuración:
`/srv/refleja/application/runtime/dev.env.before-reflejati-20261025`.

Si falla la migración, restaurar mediante SSM ese archivo sobre el runtime y
levantar la release anterior con Compose y las mismas imágenes; devolver las
variables de GitHub a nip.io y vaciar aliases antes de un despliegue posterior.
Conservar las URLs nuevas de Cognito no concede permisos ni impide ese rollback.
Nunca imprimir el contenido íntegro del runtime ni borrar volúmenes de datos.

La comprobación final del despliegue debe validar salud, login y certificado sin
ignorar TLS; redirecciones de HTTP/www/nip.io; callback OAuth nuevo y salida a
`/login`; ausencia de URLs antiguas de API en el frontend compilado. Después,
validar con el usuario el ingreso y recorrido autenticado sin enviar invitaciones
de prueba no autorizadas.

## Hallazgo operativo independiente

La consulta de SNS durante la revisión devolvió cero suscripciones en
`rti-dev-backup-alerts`. La suscripción anterior estaba pendiente de confirmación
y ya no existe. No se creó otra ni se envió una nueva confirmación como parte de
este cambio de dominio. Queda pendiente reactivar/confirmar el destinatario de
alertas para recibir fallos de copias; esto es distinto de la ejecución de backups.

El horario de apagado también tenía un `start_date` añadido fuera de Terraform.
Se conservó tal como estaba: no se quitaron las excepciones vigentes.
