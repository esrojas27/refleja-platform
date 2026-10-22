# Reportes del programa y exportaciones

Incremento del 2026-10-22. Commit y push autorizados por el usuario después de
revisar la vista previa. Los gates remotos se verifican después de publicar.

## Acceso y navegación

El consultor autorizado encuentra **Reportes** en el menú lateral del programa.
Puede consultar el programa completo o seleccionar una inscripción para generar
el reporte individual. Ambos alcances permiten descargar CSV y Excel `.xlsx`.
Líder, RRHH y colaborador conservan sus permisos actuales y no acceden a estos
reportes, ni por la ruta directa ni por la API. El correo no determina el rol;
se usa la membresía actual en la organización seleccionada.

Los programas en borrador, activos, finalizados o cancelados permiten consulta.
No se cambian estados, asignaciones o respuestas al generar un reporte.
No hay migraciones, servicios AWS adicionales ni envío de reportes por correo.

## Métricas

- **Avance**: promedio del porcentaje de cada asignación. Entrega y encuesta
  aportan 50% cada una cuando existe encuesta; sin encuesta el envío aporta 100%.
  Una entrega con cambios solicitados conserva el avance enviado; la aprobación
  se consulta por separado.
- **Aprobación**: asignaciones `COMPLETED` / todas las asignaciones vigentes.
- **Participación**: inscripciones con al menos una entrega / todas las
  inscripciones del alcance. Incluye invitadas, suspendidas, retiradas y sin
  actividades; sus estados se muestran explícitamente. No mide asistencia a sesiones.
- **Cumplimiento de fecha**: asignaciones con plazo anterior al día de corte,
  cuya última entrega y encuesta (si existe) se enviaron a más tardar en la fecha
  límite / todas las asignaciones con ese plazo terminado. El día de vencimiento
  aún no integra el denominador. No depende de la fecha de revisión o aprobación.
- **Vencidas**: plazo anterior al corte y asignación aún no aprobada, conservando
  la alerta existente del producto. Puede incluir trabajo enviado a tiempo y en revisión.

Todos los porcentajes muestran dos decimales como máximo. Sin denominador son
`null`/«No aplica» y las celdas exportadas quedan vacías. Con inscripciones y
sin entregas, participación sí es 0%. No se sustituye la falta de respuestas por
ceros en los promedios de escalas.

El corte y los límites de días usan `default_time_zone` de la organización.
El reporte informa fecha, zona y momento de generación. Se usan fechas límite,
contenido, identidad e inscripciones actuales. Es una consulta del estado actual,
no una reconstrucción histórica ni una medición de la primera entrega.
Cambiar la fecha de una actividad puede cambiar su cumplimiento reportado.
Se excluye contenido archivado, igual que en las consultas vigentes del programa.

## Encuestas y comparación

Se reutilizan los [resultados de encuestas](activity-survey-results.md), con
comparación por dimensión, sesión y actividad, distribuciones, medias separadas
de acuerdo y probabilidad, emociones y respuestas abiertas.
El alcance individual filtra asignaciones y respuestas en el servidor antes de
calcular las medias y resolver las personas. No descarga un agregado general
para filtrarlo después en el navegador. Las encuestas configuradas sin asignación
para esa persona pueden aparecer con base cero, sin respuestas ajenas.

Las comparaciones son descriptivas: preguntas diferentes pueden medir aspectos
distintos. No son puntajes ni una comparación pre/post. Las evaluaciones inicial
y final de programa requieren una definición funcional posterior.

## Contratos, privacidad y consistencia

- GET `/api/v1/organizations/{organizationId}/programs/{programId}/reports`
- GET `/api/v1/organizations/{organizationId}/programs/{programId}/reports/export?format=csv|xlsx`
- Ambos aceptan `enrollmentId` opcional y validado en el mismo programa/organización.

La API exige Cognito, resuelve el rol `CONSULTANT`, activa el tenant y valida el
programa. Inscripción o programa ajenos: 404; rol no autorizado: 403; sin sesión:
401; UUID o formato inválido: 400. No se amplía el acceso a otras rutas.

La lectura usa `REPEATABLE_READ`: progreso, personas y encuestas de una consulta
comparten un snapshot de base de datos. Cada descarga inicia una consulta nueva;
puede incluir cambios posteriores a la última actualización de pantalla.
Se envían `Cache-Control: no-store` y `X-Request-ID`. Los logs de consulta y
exportación contienen actor, organización, programa, inscripción, cantidad y
requestId; no contienen correos, nombres ni respuestas.

El reporte incluye nombres/correos, metadatos de actividades y respuestas de
encuestas. No incluye DISC, campos del perfil, texto de entregas o comentarios
privados de revisión. Los archivos deben compartirse solo con personas autorizadas.

## Archivos

El Excel usa Apache POI 5.5.1 y el formato OOXML real, siguiendo su
[documentación oficial](https://poi.apache.org/components/spreadsheet/quick-guide.html).
Tiene cuatro hojas con encabezados congelados y filtros:

1. **Ficha**: identificación, corte, alcance, definiciones y límites de interpretación.
2. **Participación**: total y una fila por inscripción, incluso sin asignaciones.
3. **Actividades**: una fila por asignación, estado, fechas y porcentaje de avance.
4. **Encuestas**: agregados, distribuciones y respuestas del alcance seleccionado.

Los números son celdas numéricas y el texto se escribe como texto, sin fórmulas
ejecutables. Los valores ausentes se conservan vacíos. Fechas e IDs se exportan
como texto para evitar conversiones automáticas.

El CSV consolida las cuatro hojas en un esquema fijo de columnas. **Sección**
identifica la tabla de origen; columnas que no corresponden a una sección quedan
vacías. Usa BOM UTF-8, coma, CRLF, escape de comillas/saltos y neutralización de
fórmulas de texto. Se recomienda Excel para una lectura más cómoda; si el CSV no
separa columnas automáticamente, importarlo como UTF-8 con delimitador coma.

Los archivos se generan en memoria y no se almacenan en el servidor ni tienen
enlaces públicos. Es adecuado para el piloto de 30 personas; grandes cohortes
requerirán paginación de servidor y exportación por streaming. Los límites del
formato Excel se rechazan sin truncar silenciosamente los datos.

## Validación manual

1. Reiniciar API y web con `dev.cmd` para cargar las nuevas rutas de la API.
2. Entrar con una membresía CONSULTANT, seleccionar organización y programa;
   abrir Reportes y comprobar nombre, fecha de corte y métricas.
3. Comparar los estados y asignaciones con Actividades. Con una entrega enviada
   y encuesta pendiente, el avance individual debe ser 50% y la aprobación 0%.
   Al responder la encuesta, avance 100%; la aprobación depende del consultor.
4. Abrir «Cómo interpretar estos datos» y revisar los denominadores. Probar sin
   asignaciones, sin personas y con inscripciones retiradas o suspendidas.
5. Seleccionar una persona, revisar únicamente su trabajo y sus respuestas;
   regresar a Programa completo y confirmar el cambio de alcance.
6. Abrir Resultados y comparación de encuestas, cambiar dimensión/sesión/actividad
   y consultar distribuciones y respuestas abiertas.
7. Descargar Excel y CSV para ambos alcances. Comparar totales, encuestas, fechas,
   acentos y textos con comas/saltos. Una descarga puede incluir datos más nuevos
   que la pantalla; actualizar antes de comparar si hubo actividad concurrente.
8. Probar con colaborador, Líder y RRHH: no deben aparecer Reportes en el menú
   ni datos al abrir la ruta o intentar exportar directamente.
9. Repetir en móvil: selector, botones, tarjetas y paginación deben permanecer
   dentro del ancho disponible.

PDF corporativo, evaluación inicial/final, anonimización y comparación entre
cohortes quedan para incrementos posteriores.

## Evidencia local

- Gate backend `mvn verify`: 295 pruebas aprobadas, sin fallos, errores u omisiones;
  incluye PostgreSQL 18 desechable, aislamiento por organización, reporte
  individual, formatos, zona horaria y reglas de arquitectura modular.
- Frontend: 269 pruebas aprobadas en 40 archivos; TypeScript y ESLint correctos.
- Chromium: 17 pruebas de navegación sin sesión aprobadas, incluida Reportes.
- Reporte general/individual y comparación de encuestas revisados visualmente a
  1600 px; versión móvil a 390 px sin desbordamiento. Los datos de las capturas
  son ficticios y las respuestas de API se simularon solo para la revisión visual.
- Excel validado abriendo los bytes generados como un libro OOXML, con cuatro
  hojas, números numéricos y texto sin fórmulas; CSV con escape y alcance individual.
- No se ejecutó el journey autenticado real contra Cognito ni se desplegó DEV
  desde esta sesión. La publicación fue autorizada por el usuario y no sustituye
  la validación de los gates remotos.
