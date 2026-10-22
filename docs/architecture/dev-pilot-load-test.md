# Prueba controlada de concurrencia del piloto

Herramienta manual, no un job automático de CI. Destino fijo: DEV, sin cambiar
la infraestructura ni desactivar autenticación. Ejecutar únicamente con permiso
del responsable, fuera de sesiones con usuarios reales y con backup previo.

## Escenario

- 30 cuentas Cognito distintas, creadas con `MessageAction=SUPPRESS`, direcciones
  sintéticas `@example.invalid` y contraseñas aleatorias. No envía invitaciones.
- Login real, secuencial, por Hosted UI/PKCE con contextos de navegador separados.
  No modifica los flujos de autenticación del cliente Cognito.
- Organización aislada, perfiles completos y programa activo: 3 dimensiones,
  6 sesiones, 12 actividades con encuestas de los cuatro tipos y 360 asignaciones.
- Un participante sintético tiene además rol consultor para consultar resultados.
- Carga HTTP autenticada: cuenta, programas, detalle, actividades, entregas,
  encuestas, consultas del consultor y HTML de la página de actividades.
- Etapas: **5 usuarios / 3 minutos**, **15 / 5 minutos**, **30 / 10 minutos**;
  pausas de 1,5–2,5 segundos entre lecturas y 15 segundos entre etapas.
- Cada usuario envía hasta cuatro actividades/encuestas por etapa, en bloques
  distintos para no sobrescribir respuestas de una etapa anterior.

No equivale a 30 navegadores descargando y renderizando todos los recursos, a
30 inicios de sesión simultáneos, ni a uso continuo durante todo el día. Tampoco
prueba SES, exportación masiva, videos, archivos o crecimiento histórico de datos.
Las latencias incluyen la conexión del equipo del operador hasta DEV.

## Operación

Requisitos: Node, AWS CLI con perfil `rti-dev` autenticado, Playwright/Chromium de
`apps/web`, DEV encendido y SSM disponible. Registrar estado inicial de EC2 y
versión desplegada. El perfil necesita permisos de Cognito, SSM, CloudWatch y S3;
no agregar esos permisos al rol de ejecución de la aplicación.

Desde la raíz del repositorio, usando un identificador nuevo por ensayo:

```powershell
aws sso login --profile rti-dev
node scripts/pilot-load-test.mjs prepare pilot-YYYYMMDD-xxxxxx
node scripts/pilot-load-test.mjs seed pilot-YYYYMMDD-xxxxxx
node scripts/pilot-load-test.mjs auth pilot-YYYYMMDD-xxxxxx
node scripts/pilot-load-test.mjs metrics pilot-YYYYMMDD-xxxxxx
node scripts/pilot-load-test.mjs smoke pilot-YYYYMMDD-xxxxxx
node scripts/pilot-load-test.mjs run pilot-YYYYMMDD-xxxxxx
node scripts/pilot-load-test.mjs verify pilot-YYYYMMDD-xxxxxx
node scripts/pilot-load-test.mjs metrics pilot-YYYYMMDD-xxxxxx
node scripts/pilot-load-test.mjs cleanup pilot-YYYYMMDD-xxxxxx
node scripts/pilot-load-test.mjs verify pilot-YYYYMMDD-xxxxxx
```

`YYYYMMDD` debe ser una fecha de ocho dígitos; `xxxxxx`, seis caracteres
alfanuméricos minúsculos. `seed` ejecuta backup antes de crear los datos sintéticos.
La preparación SQL usa una transacción; la carga utiliza la API real y sus permisos.

No repetir `run` sobre datos que ya recibieron entregas: crear un ensayo nuevo.
Si falla un paso, detenerse, diagnosticar y **ejecutar cleanup igualmente**;
si AWS no está disponible, registrar el identificador y retomar la limpieza al
restablecer el acceso. No restaurar una copia sobre DEV para limpiar un ensayo.

## Protección y evidencia

- Se detiene si falla una escritura, aparecen cinco errores en las últimas
  cincuenta solicitudes, un contenedor deja de estar saludable, hay OOM, quedan
  menos de 160 MiB disponibles o se pierde el monitoreo de infraestructura.
- No avanza a la siguiente etapa si hubo errores o el p95 agregado supera 2 s.
  Revisar también p95 por endpoint; el agregado no sustituye esa revisión.
- Monitor de memoria/disco, `docker stats` y salud aproximadamente cada 30–40 s;
  métricas EC2/CPU/créditos en ventanas CloudWatch de 5 minutos.
- Para parar: Ctrl+C o crear un archivo `STOP` en el directorio local del ensayo.
- Resultados bajo `.local/load-tests/<id>/`: resúmenes por etapa y endpoint,
  muestras de recursos, CloudWatch y conteos de persistencia. No subir esa carpeta.
- `private.json` contiene credenciales y cookies durante el ensayo: no imprimir,
  compartir, adjuntar ni registrar trazas/screenshots del login. Usar un equipo
  confiable con acceso restringido; no sincronizar la carpeta con terceros.
- La limpieza elimina solo las identidades Cognito del ensayo tras comprobar
  su `sub`, y elimina las credenciales/cookies guardadas en el archivo local.
  Desactiva la organización/usuarios, revoca membresías y retira inscripciones.
  Conserva los registros sintéticos de actividades y respuestas, identificables
  por organización, para evidencia; **no borra datos reales**.
- Verificar ausencia de cuentas sintéticas en Cognito y estado desactivado en BD.
  Si DEV estaba apagado antes, devolverlo a ese estado al terminar, salvo acuerdo
  explícito de mantenerlo encendido. No cambiar horarios ni tamaño por este ensayo.

El resultado mide un escenario acotado, no una garantía de capacidad máxima,
alta disponibilidad ni un SLA. La aprobación del piloto requiere además el
[checklist de preparación](pilot-readiness.md).
