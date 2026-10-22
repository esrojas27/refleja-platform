# Copias y restauración de DEV

Implementado y probado el 2026-10-20 (America/Bogota; evidencias AWS del 21 UTC).
Alcance: PostgreSQL del piloto, sin agregar otra instancia permanente. Integración
con despliegue/CI publicada en `2c2e730`; [gate de infraestructura](https://github.com/esrojas27/refleja-platform/actions/runs/39544894084)
y [despliegue DEV](https://github.com/esrojas27/refleja-platform/actions/runs/39545268208)
exitosos, comprobados el 2026-10-21.

## Qué queda protegido

- Base completa: datos, secuencias, restricciones, índices, funciones, propietarios,
  permisos, políticas RLS e historial Flyway; roles sin contraseñas.
- Copia lógica comprimida con `pg_dump -Fc` de PostgreSQL 18. El conteo de todas
  las tablas y el dump comparten un snapshot MVCC, incluso con escrituras concurrentes.
- Archivo único en `s3://rti-dev-backups-836528258662/backups/postgres/`, con SHA-256
  del archivo y de sus componentes, cifrado SSE-S3 AES256, acceso privado y versionado.
- Retención corriente de 30 días. S3 crea después un marcador de borrado y elimina
  la versión no corriente al día siguiente; la ejecución del lifecycle es asíncrona.
  Las reglas nuevas no expiran los paquetes del prefijo `deployments/`.
- La instancia puede escribir/leer copias, pero ya no tiene `s3:DeleteObject`.
  Esto no es Object Lock ni un respaldo inmutable frente al administrador de AWS.

No incluye Cognito, contraseñas de Parameter Store, DNS, archivos futuros ni una
imagen completa del servidor. Terraform y Git permiten reconstruir el servidor;
las identidades Cognito existentes y los secretos deben conservarse separadamente.
El backup contiene datos personales: no descargarlo al repositorio ni enviarlo por correo.

## Automatización y avisos

`refleja-backup.timer` ejecuta una copia:

- lunes a viernes a las **19:00 America/Bogota**, con hasta 60 segundos de dispersión;
- aproximadamente 15 minutos después del arranque;
- recupera una ejecución calendario omitida al volver a encenderse (`Persistent=true`).

No enciende EC2 ni cambia el horario 08:00–20:00. Con la máquina apagada no hay
copias. Cambiar el horario del piloto requiere revisar también este timer.
Como objetivo inicial: copias diarias en jornadas activas, con intervalos mayores
en fines de semana/apagados. No hay recuperación a un segundo exacto (PITR/WAL).
Las escrituras posteriores a la última copia exitosa podrían perderse.

El deployment preparado genera además una copia **antes** de reemplazar servicios
o ejecutar migraciones. Si falla, aborta el despliegue. Un lock compartido evita
solapar backup, ensayo de restauración y deployment. No hay restauración automática
sobre DEV en caso de fallo de despliegue: volver a una imagen no revierte migraciones.
Esta integración ya está publicada; el timer también está instalado.

- Fallo de backup o ensayo: publicación inmediata al tópico `rti-dev-backup-alerts`.
- Ausencia de éxito: alarma CloudWatch `rti-dev-backup-missing`, tres períodos
  diarios sin éxitos (tolera el fin de semana; no es detección inmediata).
- Destinatario: `marcayconexion@paularojas.com.co`.
- **Pendiente del destinatario:** abrir el email de Amazon SNS y pulsar
  **Confirm subscription**. Sin confirmarlo, la alarma existe pero no llegan avisos.
  La verificación de SES no confirma esta suscripción.
- Logs sin contenido de las tablas: journal del servicio y resultado de SSM.

Se reutilizan EC2/S3. La métrica y alarma agregan aproximadamente USD 0,40/mes
antes de franquicias/impuestos, más solicitudes SNS de bajo volumen. El espacio
S3 depende de tamaño, frecuencia y retención; la reserva previa de 5 GB es una
estimación, no un límite. Revisar consumo al crecer los datos.

## Operación desde PowerShell 7

Desde la raíz del repositorio, con DEV encendido y SSM online:

```powershell
aws sso login --profile rti-dev
./scripts/invoke-dev-database-backup.ps1 -Action Status
./scripts/invoke-dev-database-backup.ps1 -Action List
./scripts/invoke-dev-database-backup.ps1 -Action Backup
./scripts/invoke-dev-database-backup.ps1 -Action Verify -BackupKey '<clave exacta de List>'
```

`Verify` descarga la copia elegida y crea un PostgreSQL temporal **sin red ni
puertos publicados**, sin montar el volumen de DEV. Verifica checksums, restaura
con error fatal y transacción única, compara conteos/migraciones/RLS/roles y elimina
el contenedor y su directorio al finalizar, incluso ante fallos normales.
Las tablas restauradas nunca se muestran en la salida. Un apagado abrupto puede
dejar un directorio temporal privado; revisarlo antes de limpiar manualmente.

El ensayo limita CPU a 0,25 y memoria a 192 MiB, comprueba al menos 256 MiB libres
y espacio de disco de margen. Ejecutarlo fuera de una sesión de usuarios. Si la
base crece y no cabe en esos límites, ajustar el ensayo antes de asumir que la
copia sigue siendo recuperable. Repetir tras cambios importantes y antes del piloto.

## Recuperación ante un incidente real

El comando `Verify` es un ensayo, no una conmutación de la aplicación. Para
recuperar servicio tras pérdida/corrupción:

1. Registrar incidente, última copia y versión del programa; detener escrituras
   de API y evitar despliegues. Conservar el volumen anterior para investigación.
2. Aprobar explícitamente el punto de recuperación y la pérdida de cambios posterior.
3. Preparar PostgreSQL 18 limpio en un volumen nuevo y aislado. No ejecutar las
   migraciones/init de la aplicación antes de restaurar. Usar un superusuario de
   recuperación distinto de los roles guardados, como en el ensayo.
4. Descargar copia, verificar SHA-256, restaurar `roles.sql`; crear la base con
   el nombre de `database-name.txt` y propietario `postgres`; restaurar `database.dump`
   con `pg_restore --exit-on-error --single-transaction`. No usar `--clean` sobre DEV.
5. Comparar `verify.sql` con `expected.txt`. Reestablecer contraseñas de `postgres`,
   `rti_migrator` y `rti_app` desde Parameter Store, sin imprimirlas. El dump de roles
   deliberadamente no contiene hashes de contraseñas.
6. Desplegar primero la versión de `release.txt`, conectar al volumen recuperado,
   comprobar salud, login, aislamiento, programa y respuestas; luego reabrir usuarios.
   Aplicar versiones/migraciones posteriores solo con revisión y copia nueva.
7. Registrar duración completa, pérdida real y responsables. Mantener el volumen
   anterior hasta la aprobación del incidente; retirarlo después por acción explícita.

El tiempo del ensayo de base no incluye reconstruir EC2, secretos, DNS ni validar
la aplicación. No se ha hecho una conmutación destructiva ni certificado un RTO total.

## Evidencia y comprobaciones

- Terraform aplicado: **3 recursos nuevos, 2 modificaciones, 0 destrucciones**:
  tópico/subscripción SNS, alarma, lifecycle S3 y permisos de la instancia.
- Instalación/primera copia SSM: `89102135-2f28-48aa-8fb7-ff33571c9b23`.
- Copia: `backups/postgres/2026/10/21/20261021T042216Z-scheduled-KhnBOIFK.tar`,
  122.880 bytes, cifrado AES256, captura en 3 segundos; versión app `aa57b0a`.
- Ensayo exitoso SSM: `ff91d6ca-753d-4f8f-ae5c-dca97ccb3557`:
  **20 tablas**, comparaciones completas, **10 segundos**, `network=none`, destino
  desechable; no contenedores de ensayo restantes; salud pública **UP**.
- Dos ensayos preliminares detectaron permisos del mount e inicialización temporal
  de PostgreSQL 18. Corregidos: raíz del mount atravesable y espera con consulta
  TCP al servidor final. Ninguno modificó DEV.
- Bash/ShellCheck y Terraform validate correctos. Comandos PowerShell List/Status
  probados. CI incorpora prueba con datos sintéticos y AWS simulado para restaurar,
  rechazar claves ajenas/checksum incorrecto/subida fallida y comprobar limpieza.
  La nueva prueba de restauración sintética también pasó en GitHub en el gate
  `39544894084`, publicado con `2c2e730`.

Fuentes: [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html),
[roles sin contraseñas](https://www.postgresql.org/docs/18/app-pg-dumpall.html),
[retención S3 versionado](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html),
[CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/).
