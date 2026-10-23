# Resultados agregados de las encuestas de actividad

Incremento implementado localmente el 2026-10-19. El usuario autorizó su commit y
push junto con el incremento anterior de administración de contenido (`c5ba5dc`).
La verificación remota de los gates se realiza después de publicar.

## Alcance

Nueva sección **Resultados de encuestas** en la navegación lateral del programa,
exclusiva de consultores con acceso a esa organización. Las respuestas existentes
aparecen sin reenviar encuestas ni migrarlas.

- Resumen del programa o alcance seleccionado: encuestas asignadas/respondidas,
  pendientes, tasa de respuesta y participantes distintos.
- Filtros combinables por dimensión, sesión y actividad. Cambiar un padre limpia
  los filtros dependientes. El catálogo muestra contenido vigente con encuesta.
- Comparación de dimensiones, sesiones o actividades, conservando su contexto.
- Distribuciones por pregunta, incluyendo opciones con cero selecciones.
- Media de cada escala y medias descriptivas por tipo en cada nivel.
- Emociones ordenadas por selecciones y señalización de las más seleccionadas,
  incluyendo empates.
- Respuestas abiertas y detalle individual identificado por nombre, correo y
  fecha de envío. La interfaz recorre participantes en páginas de cinco.
- Exportación CSV autenticada del alcance filtrado: resúmenes, medias,
  distribuciones y respuestas individuales.
- Consulta también en programas finalizados/cancelados. No habilita escrituras.

No se añaden permisos para Líder, RRHH o colaborador. No se consulta ni exporta
DISC, perfil básico, instrucciones de la actividad, entregas o revisiones.
Los datos de nombre/correo son los actuales de la identidad interna, no un
snapshot histórico capturado al responder.

## Interpretación de los datos

`assignedCount` cuenta asignaciones de actividades con encuesta dentro del
alcance, no todas las personas inscritas. Una persona asignada a dos encuestas
aporta dos asignaciones; el contador de participantes distintos no la duplica.
Las pendientes incluyen a quienes aún no han enviado la actividad.

`responseCount` cuenta encuestas efectivamente enviadas, independientemente de
la revisión posterior de la actividad. La tasa es respondidas / asignadas × 100;
sin asignaciones es null (no aplicable). Los promedios sin respuestas son null,
nunca cero. Una pendiente no aporta cero ni modifica una media.

Acuerdo y probabilidad permanecen separados. La media por pregunta usa únicamente
sus respuestas de 1 a 5. La media de dimensión/sesión/actividad reúne las respuestas
del mismo tipo de escala; `n` es el número de respuestas de escala, no el número de
participantes únicos. Los resultados se redondean a dos decimales.

La escala numérica genérica (`NUMERIC_SCALE`) presenta solo 1–5 y tiene
distribución y media por pregunta. No se agrega a las medias de acuerdo ni
probabilidad, ni se mezclan sus enunciados en una media global sin significado
común. Las respuestas/exportaciones conservan el valor numérico sin etiquetas.

Las preguntas pueden tener significados distintos: estas medias son descriptivas,
no una calificación, un diagnóstico psicométrico ni una comparación pre/post.
El consultor dispone del desglose por pregunta para interpretar cada resultado.

En emociones, cada porcentaje divide selecciones de esa emoción entre personas
que respondieron la pregunta. Como pueden elegir dos, los porcentajes pueden
sumar más de 100%. Nunca se divide entre el total de selecciones ni se interpreta
la emoción como una escala numérica.

El contenido archivado sin entregas se excluye, igual que en el progreso vigente.
El incremento anterior bloquea archivar contenido con entregas; sus resultados se
conservan. No se elimina, modifica ni deduplica ninguna respuesta existente.

## API, permisos y coherencia

- GET `/api/v1/organizations/{organizationId}/programs/{programId}/survey-results`
- GET `/api/v1/organizations/{organizationId}/programs/{programId}/survey-results/export`
- Ambos aceptan `dimensionId`, `sessionId` y `activityId` opcionales.

La API valida el rol CONSULTANT en la membresía real, activa RLS y comprueba el
programa en esa misma organización. Rechaza filtros ajenos o combinaciones
incompatibles con 404, sin devolver un agregado global por error. IDs mal
formados devuelven 400. Sesión ausente: 401; rol sin permiso: 403.

Reportes y exportación usan el mismo servicio/modelo, bajo transacción de lectura
REPEATABLE_READ para que los conteos y detalles de una consulta sean coherentes.
Cada nueva descarga toma una consulta nueva: puede incluir respuestas enviadas
desde la última actualización de pantalla; los filtros son los mismos.

Las respuestas y el CSV se envían con no-store y requestId. Los logs registran
consulta/exportación, actor, organización, programa, filtros y conteo, sin nombres,
correos ni textos de respuestas. No hay enlace público al CSV ni archivo
persistido en el servidor.

El CSV incluye BOM UTF-8, separador coma, CRLF y celdas entre comillas con escape
de comillas/saltos de línea. Neutraliza posibles fórmulas al exportar texto con
prefijos peligrosos. La respuesta original no se modifica. Si Excel no separa
columnas automáticamente, importar como UTF-8 con delimitador coma.
El archivo incluye datos personales: compartir únicamente con autorizados.

La primera versión consulta respuestas/valores por lotes y resuelve identidad
una vez por participante que respondió. El modelo completo se carga en memoria,
con paginación de presentación; para cohortes muy grandes quedarán la paginación
de servidor y exportación en streaming. No se añaden servicios AWS, infraestructura,
librerías de gráficos, migraciones ni un sistema de BI.

## Validación manual

1. Reiniciar API/web con `dev.cmd`. Entrar como consultor y abrir un programa que
   ya tenga respuestas; entrar a Resultados de encuestas desde el menú lateral.
2. Confirmar asignadas, respondidas y pendientes. No confundir encuestas enviadas
   con actividades aprobadas ni con personas únicas.
3. En un programa de prueba activo, configurar una encuesta con los cinco tipos
   antes de la primera entrega. Responder como dos colaboradores: acuerdo 1 y 5
   debe mostrar media 3; probabilidad 2 y 4 debe mostrar otra media 3, n=2 cada una.
   La escala numérica debe mostrar solo 1–5 y su propia media por pregunta, sin
   afectar los agregados de acuerdo/probabilidad.
4. Elegir la misma emoción con ambos y otra adicional con uno: la primera tendrá
   2/2=100% y la otra 1/2=50%. Revisar las opciones con cero selecciones.
5. Dejar una tercera encuesta/asignación pendiente y verificar que no entra como
   cero en los promedios. Revisar también un programa sin encuestas y otro sin
   respuestas: mostrar estados vacíos y medias no disponibles.
6. Abrir el detalle por actividad y por participante; verificar textos abiertos,
   escalas etiquetadas, emociones, nombre/correo y fecha. Con seis participantes,
   comprobar la navegación de páginas.
7. Filtrar dimensión → sesión → actividad; cambiar la dimensión y confirmar que
   se limpian sesión/actividad. Cambiar Comparar por entre los tres niveles.
8. Exportar CSV con un filtro activo. Abrir/importar en Excel o una hoja de cálculo
   y revisar que contiene ese alcance, medias, distribuciones y respuestas.
9. Cerrar/finalizar un programa de prueba y confirmar que conserva sus resultados.
10. Con Líder/RRHH/colaborador, comprobar que no aparece el menú ni se puede
    acceder a los resultados pegando la ruta. Probar sesión ausente y otra
    organización; no debe aparecer información del programa anterior.
11. Revisar en ancho móvil: filtros apilados, tarjetas, barras y textos largos
    dentro del ancho disponible, acordeones y paginación operables.

No se incluyen evaluaciones inicial/final de programa, puntajes, anonimización,
comparación longitudinal entre cohortes, análisis automático de texto ni PDF/XLSX.

## Verificación local

- `mvn.cmd -o verify` con PostgreSQL 18/Testcontainers: 263 pruebas correctas,
  sin fallos, errores ni omisiones. Se aplicaron límites temporales de memoria
  (Maven 256 MiB, pruebas 384 MiB y dos procesadores).
- `npm.cmd test -- --maxWorkers=1`: 197 pruebas correctas en 32 archivos.
- TypeScript sin emisión y ESLint: correctos.
- `playwright test --list`: 17 pruebas registradas, incluida la nueva ruta
  protegida de Resultados de encuestas. No se ejecutaron navegador ni journey
  real con Cognito en esta iteración.
- `git diff --check`: correcto.

Las pruebas cubren múltiples dimensiones/sesiones/actividades y participantes,
medias separadas y redondeo, base de porcentajes en emociones, ceros y null,
pendientes/archivadas, permisos y filtros ajenos, consulta después del cierre,
CSV sin entregas privadas y sin alterar la respuesta original, escape de
fórmulas/comillas/saltos, filtros dependientes y descarga autenticada, paginación
visual y descarte de resultados al perder autorización.

No se levantó Next.js, no se hizo build de producción ni despliegue desde esta
sesión. La publicación fue autorizada por el usuario; esto no sustituye la
validación visual ni el resultado de los gates de GitHub.
