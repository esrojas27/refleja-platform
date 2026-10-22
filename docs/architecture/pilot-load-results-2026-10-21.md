# Resultado: concurrencia del primer piloto

**Resultado de carga: aprobado para el escenario ensayado de hasta 30 usuarios.**
No se encontró una razón de capacidad para ampliar la instancia antes del piloto.
Esto no reemplaza el ensayo funcional de la empresa ni certifica un máximo de
usuarios, operación 24/7 o alta disponibilidad.

## Identificación y alcance

- Fecha local: 2026-10-21, America/Bogota, aproximadamente 22:17–22:36.
  Evidencias UTC: 2026-10-22, 03:17–03:36.
- Ensayo: `pilot-20261021-a7c9e2`.
- Aplicación desplegada: `2c2e7300cef159c75363dc8945843eac4362ae2e`.
- [Deploy exitoso](https://github.com/esrojas27/refleja-platform/actions/runs/39545268208),
  [CI funcional](https://github.com/esrojas27/refleja-platform/actions/runs/39544894170),
  [contenedores](https://github.com/esrojas27/refleja-platform/actions/runs/39544894109)
  e [infraestructura/backup](https://github.com/esrojas27/refleja-platform/actions/runs/39544894084).
- DEV existente: EC2 t4g.small ARM, 2 vCPU y 2 GiB, CPU standard, sin aumentar
  tamaño ni agregar servicios permanentes. API, web, PostgreSQL y Caddy comparten
  la instancia. URL temporal HTTPS existente, sin cambios DNS.
- 30 identidades Cognito sintéticas distintas, login real y separado; sin enviar
  correos. Una de ellas consultó además las vistas del consultor.
- Programa aislado con 3 dimensiones, 6 sesiones, 12 actividades y sus encuestas
  de cuatro tipos; 360 asignaciones. No se usaron participantes reales.
- Backup previo: `backups/postgres/2026/10/22/20261022T031037Z-pre-load-test-luKgV3AB.tar`.
  Tamaño 122.880 bytes, captura 3 segundos, anterior a los datos sintéticos.

Metodología y repetición: [procedimiento del ensayo](dev-pilot-load-test.md).
No se ejecutó tráfico de 30 navegadores completos: tras autenticar cada cuenta,
la carga fue HTTP/API con pausas de lectura de 1,5–2,5 segundos, solicitudes HTML
y envíos de actividades/encuestas. No se ensayó login simultáneo ni correo SES.

## Resultados medidos

Latencias de extremo a extremo desde el equipo del operador, en milisegundos.
Percentil p95: el 95 % de las solicitudes tardó como máximo ese valor.

| Usuarios simultáneos | Duración real | Solicitudes | Errores | Mediana | p95 | p99 | Máxima |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | 182 s | 491 | 0 | 104 ms | 257 ms | 666 ms | 853 ms |
| 15 | 302 s | 2.370 | 0 | 100 ms | 132 ms | 265 ms | 522 ms |
| 30 | 603 s | 9.268 | 0 | 96 ms | 111 ms | 245 ms | 412 ms |

Total: **12.129 solicitudes medidas, cero errores**. La etapa de 30 usuarios
produjo aproximadamente **15,4 solicitudes/s** con las pausas del escenario.
No es una prueba de saturación a máxima tasa. Los menores tiempos de etapas
posteriores no significan que agregar usuarios mejore el rendimiento: influyen
calentamiento, cachés y variación de red.

Detalle de la etapa de 30 usuarios:

| Operación | Solicitudes | p95 |
| --- | --- | --- |
| Cuenta | 2.147 | 104 ms |
| Lista de programas | 2.137 | 107 ms |
| Detalle del programa | 2.127 | 105 ms |
| Actividades del colaborador | 2.120 | 111 ms |
| Enviar actividad | 120 | 140 ms |
| Enviar encuesta | 120 | 124 ms |
| Resultados del consultor | 24 | 276 ms |
| Actividades del consultor | 24 | 341 ms |
| HTML de actividades | 449 | 142 ms |

Antes se ejecutó una prueba corta de un usuario, 10 solicitudes sin errores,
y se comprobó que las 30 cuentas veían únicamente las 12 actividades esperadas
del programa sintético. Esas solicitudes no están incluidas en la tabla principal.

## Persistencia y recursos

Comprobación posterior en PostgreSQL: **195 entregas, 195 encuestas y 975 valores
de respuesta**. Cada encuesta contenía cuatro preguntas; la selección de dos
emociones aporta dos valores. Los conteos coinciden con las escrituras exitosas
de las tres etapas; no se encontraron encuestas incompletas en el chequeo.

En las 32 muestras de infraestructura del ensayo:

- Memoria disponible mínima del host: **880,4 MiB**.
- Espacio disponible mínimo del volumen de datos: **23,42 GiB**.
- Cuatro contenedores saludables; cero reinicios y ningún indicador OOM observado.
- Máximos de memoria observados: API **444,8/640 MiB**, web **73,58/320 MiB**,
  PostgreSQL **75,88/384 MiB**, Caddy **20,64/64 MiB**.
- En las ventanas CloudWatch que cubren la carga, máxima CPU media **8,64 %**;
  máximo de las muestras disponibles **10,83 %**. No son picos instantáneos.
- Saldo de créditos CPU: **576** en todas las muestras disponibles; no se observó
  agotamiento neto. Los status checks EC2 disponibles fueron cero fallos.

No se infiere de estos datos capacidad para más de 30 usuarios, días enteros de
carga, bases mucho mayores, exportaciones masivas o reproducción/subida de archivos.

## Limpieza y cierre

- Eliminadas las 30 identidades Cognito sintéticas; consulta final: **0 restantes**.
- Organización y usuarios de prueba desactivados, membresías revocadas,
  **0 inscripciones activas y 30 retiradas**. Se conservaron los registros
  sintéticos de entregas/encuestas como evidencia; no se borraron datos reales.
- Una sesión sintética anterior, con token todavía vigente, recibió **HTTP 403**
  al intentar acceder a las actividades después de la limpieza.
- Contraseñas, tokens y cookies retirados del archivo local de estado;
  verificación sin mostrar secretos. Ningún archivo privado se agregó a Git.
- Endpoint público `/health`: **UP** después de limpiar y antes del apagado.
- EC2 estaba apagado antes del ensayo; se devolvió a ese estado y AWS confirmó
  **stopped**, sin modificar el horario de encendido/apagado existente.
- La suscripción SNS de backup continúa en **PendingConfirmation**: el contacto
  debe confirmar el correo de Amazon SNS. SES verificado no sustituye ese paso.
- La prueba de carga es manual: publicar sus scripts e informe no vuelve a
  ejecutarla ni crea nuevamente las cuentas sintéticas.

## Decisión para el piloto

Mantener por ahora el tamaño y presupuesto de infraestructura; empezar con la
primera empresa de hasta 30 personas y monitorear sus sesiones. Volver a medir
si aumenta la concurrencia, el histórico o el tipo de operaciones.

Antes de convocar usuarios: completar el recorrido funcional con el programa real,
confirmar el correo de alertas SNS, acordar horario/soporte y cerrar el dominio
profesional y DNS del correo. La dirección temporal no se cambió en este ensayo.
La lista completa sigue en [preparación del piloto](pilot-readiness.md).

Evidencia local ignorada por Git: `.local/load-tests/pilot-20261021-a7c9e2/`,
archivos `results.json`, `resources.json`, `cloudwatch-*.json` y
`verification-load.json`, `verification-cleanup.json` y `cleanup-access.json`.
No publicar archivos privados, credenciales ni cookies.
