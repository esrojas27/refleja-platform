# Checkpoint y preparación del primer piloto

Fecha: 2026-10-20, America/Bogota. Alcance previsto: primera empresa, máximo
30 participantes. Este documento registra prioridades y decisiones pendientes;
no autoriza compras de dominios, modificaciones DNS ni recursos nuevos.

## Punto actual

- `aa57b0a` publicado en master, sobre administración de participantes (`ffc2415`)
  y rotación del remitente/SES (`1f618d6`). Worktree limpio antes de este checkpoint.
- CI `39541089622` y contenedores `39541089540`: exitosos.
- Deploy `39541492017`: exitoso al cerrar el checkpoint, incluidas las
  comprobaciones públicas HTTPS del workflow. Esto no sustituye el ensayo manual
  del programa de la primera empresa ni una prueba de carga.
- Remitente API/Cognito corporativo y acceso de producción SES aplicados en AWS,
  región us-east-1. No se verifican destinatarios individualmente en SES.

La base funcional implementada comprende organizaciones y roles; invitaciones y
perfil; programas, ciclo de vida y plantillas; dimensiones, sesiones, actividades
y administración de contenido; asignación, entrega y revisión; encuestas por
actividad, progreso y resultados/exportación para el consultor; DISC restringido;
y administración/historial de participantes. Esto no equivale a haber terminado
el producto ni a tener alta disponibilidad o capacidad concurrente certificada.

## Lista de salida para recibir usuarios reales

| Orden | Preparación | Condición de aceptación |
| --- | --- | --- |
| 1 | Despliegue y recorrido real | Deploy exitoso; consultor y colaborador recorren el flujo en DEV, también desde móvil |
| 2 | Backup y restauración | Copia PostgreSQL automática en S3, retención y aviso de fallo; restauración comprobada en una BD aislada, sin sobreescribir DEV |
| 3 | Dirección de marca | Dominio/subdominio elegido, control DNS confirmado, HTTPS válido, login/logout y enlaces de invitación con URL nueva |
| 4 | Autenticación del correo | DKIM correcto, revisión de DMARC sin interferir con el correo corporativo existente, prueba de bienvenida/invitación y spam |
| 5 | Carga del piloto | Prueba con datos sintéticos a 5/15/30 concurrentes; medir latencia, errores, memoria, disco y créditos CPU; corregir y repetir si falla |
| 6 | Datos y permisos de la empresa | Organización y programa reales preparados; roles confirmados; comprobar aislamiento, restricciones de DISC y resultados, retiro/suspensión y recuperación de cuenta |
| 7 | Acuerdo operativo | Consentimiento e información de privacidad, retención y responsable de incidencias; horario y límites de disponibilidad comunicados |
| 8 | Operación controlada | Versión estable para sesiones, cambios/despliegues coordinados, alarmas útiles, retención de imágenes alineada y costos revisados |

Backup V1 autorizado e instalado tras este checkpoint: copia automática a S3,
retención corriente de 30 días y ensayo aislado exitoso con las 20 tablas, sin
modificar DEV. Actualización 2026-10-21: integración pre-deploy/CI publicada en
`2c2e730`, gate `39544894084` y deploy `39545268208` exitosos. Todavía falta
confirmar la suscripción de alertas por correo. Detalles, límites y comandos en
[Backup y restauración](dev-backup-restore.md). El ensayo no certifica el tiempo
de recuperación completo de la infraestructura ni protege escrituras posteriores
a la última copia. Vigilar volumen/retención dentro del presupuesto.

## Cambiar la URL temporal

### Opción A: subdominio del dominio actual

Propuesta de nombre: `plataforma.paularojas.com.co` (nombre por confirmar;
no se comprobó ni cambió su DNS). También puede elegirse un nombre de piloto.

No requiere comprar otro dominio. El administrador DNS actual puede crear un
registro A para el subdominio hacia la Elastic IP `18.210.172.252`. No hace falta
mover todo el dominio a Route 53 ni cambiar registros de la web, MX o correo.
Confirmar primero si el subdominio ya existe para no sobrescribir otro servicio.

Alternativamente se puede delegar solo el subdominio a Route 53. Eso exige un
registro NS en el proveedor padre y una zona nueva; no elimina la necesidad de
coordinar con el dueño DNS y agrega costo. No es necesario para el piloto pequeño.

### Opción B: dominio independiente

Elegir nombre y extensión, comprobar disponibilidad y precio de renovación, y
registrarlo a nombre de la empresa con acceso institucional, MFA y renovación
controlada. No se ha confirmado disponibilidad de ningún nombre ni autorizado
una compra. Después se puede usar `app.<dominio>` con el mismo servidor actual.

El registro anual no estaba incluido en la estimación AWS de USD 12–15/mes antes
de impuestos. Si se usa Route 53, considerar además zona y consultas; no es
obligatorio usarlo si el proveedor elegido ya incluye DNS.

### Cambios coordinados al migrar

1. Aprobar el hostname exacto y confirmar acceso al DNS autoritativo.
2. Revisar registros existentes; agregar el A del host hacia la IP fija.
3. Ajustar hostname/URL pública en Terraform y variables del environment GitHub
   (`RTI_DEV_HOSTNAME`, `RTI_DEV_PUBLIC_URL`), sin crear otra instancia.
4. Agregar callbacks y logout nuevos a Cognito, conservando localhost y la URL
   anterior durante la transición. Mantener el pool y cliente existentes.
5. Generar HTTPS con Caddy para el nombre nuevo y reconstruir/desplegar el frontend:
   sus valores `NEXT_PUBLIC_*` se incorporan al build, no basta un cambio DNS.
6. Alinear origen API/CORS, redirecciones y `INVITATIONS_WEB_BASE_URL` con la URL
   nueva. No olvidar los enlaces en correos enviados después de la migración.
7. Probar login, logout, invitación, perfil, actividad/encuesta y consulta/exportación
   desde desktop y móvil. Confirmar certificado y ausencia de mixed content.
8. Definir la transición de enlaces antiguos: conservar temporalmente o redirigir,
   y retirar callbacks/orígenes antiguos solo tras validar y comunicar el cambio.

El nombre de la aplicación web y la autenticación DNS de SES son trabajos
relacionados pero distintos. Usar otro dominio para la plataforma no corrige
automáticamente DKIM del remitente `marcayconexion@paularojas.com.co`.

## Límites de DEV como ambiente piloto

La instancia única t4g.small, con 2 GiB de RAM, comparte web, API y PostgreSQL.
No hay réplica ni failover multi-AZ. Treinta cuentas registradas no certifican
treinta usuarios activos simultáneamente. Actualización 2026-10-21: el ensayo
sintético de 5/15/30 usuarios pasó sin ampliar la instancia: 12.129 solicitudes,
cero errores, p95 de 111 ms en la etapa de 30 usuarios. Se verificaron 195 entregas
y 195 encuestas. No fue carga contra usuarios reales ni 30 navegadores completos;
no certifica operación continua ni capacidad superior. Ver
[resultados y límites del ensayo](pilot-load-results-2026-10-21.md).

El horario es lunes–viernes 08:00–20:00, America/Bogota. Ajustarlo al piloto con
presupuesto explícito si los participantes trabajan fuera de ese horario. Un
dominio profesional no transforma el ambiente en producción ni lo vuelve 24/7.
Evitar pruebas destructivas y publicaciones libres mientras se recojan datos de
la primera empresa; más adelante separar DEV interno del ambiente de clientes.

La regla actual de retención ECR busca etiquetas `dev-*`, mientras el deployment
etiqueta con SHA/intento. Alinear esa política antes de que se acumulen imágenes.
No se cambió durante la revisión de preparación.

## Incrementos de producto que continúan pendientes

- Evaluaciones inicial/final del programa y comparación pre/post: falta cerrar
  preguntas y reglas con Paula. No confundirlas con las encuestas por actividad
  ya implementadas. Si la primera empresa las exige, pasan al alcance previo.
- Visibilidad funcional final y reportes para Líder/RRHH: los roles/invitaciones
  existen, pero no se deben ampliar permisos implícitamente.
- Recordatorios de actividades próximas a vencer y vencidas. La bandeja de
  [notificaciones internas](in-app-notifications.md) cubre asignaciones, entregas,
  revisión y encuestas pendientes, sin correos; los avisos por fecha quedan para
  otro incremento.
- Evidencias/archivos adjuntos si el programa piloto los necesita; confirmar el
  alcance de las actividades, sin asumir que la respuesta textual basta.
- Versionado/gestión avanzada de plantillas y nuevas correcciones de contenido
  con respuestas existentes, conservando los bloqueos e historial aprobados.
- Mejoras de UX, accesibilidad e idioma surgidas del ensayo y del piloto.

## Siguiente paso propuesto

Confirmar el correo de alertas. Backup/restauración ya está publicado. El usuario
eligió comprar un dominio independiente y dejó su definición para después;
no hay compra ni cambio DNS autorizado. Continuar con migración de URL + DKIM,
preparación de datos y ensayo completo. Procedimiento de la prueba de carga:
[concurrencia del piloto](dev-pilot-load-test.md).
No se aplicarán cambios de dominio sin esa elección y la autorización posterior.
