# Preguntas de tipo tabla

Las actividades y las encuestas de cierre de sesión comparten el tipo TABLE. El consultor define un encabezado de esquina, de 1 a 10 columnas de respuesta y de 1 a 20 filas de respuesta. Los encabezados son obligatorios (hasta 200 caracteres). Solo se editan los encabezados; las respuestas las completa el colaborador.

Todas las celdas interiores son texto libre obligatorio, de hasta 150 caracteres. No se interpretan fechas, porcentajes ni fórmulas. Se permiten valores repetidos y se conserva el orden por fila. Una respuesta incompleta no se puede enviar, tanto desde la interfaz como desde la API.

La definición viaja en la lista options existente, con formato versionado: TABLE_V1:filas:columnas, encabezado de esquina, encabezados de columnas y encabezados de filas. Así las plantillas de formularios y programas conservan la definición sin copiar respuestas. Los valores se almacenan por fila en la estructura de respuestas existente, hasta 200 valores por pregunta.

La migración V20261125010000 es aditiva: agrega TABLE al catálogo y amplía el máximo de posiciones de respuesta. No transforma ni elimina datos existentes. Las reglas de edición y cierre existentes siguen vigentes.

Las vistas de consulta reconstruyen la tabla con sus encabezados. CSV y Excel identifican cada celda mediante fila / columna en la columna Valor y conservan el texto en Respuesta. Estas respuestas no generan promedios ni distribuciones numéricas.

## Validación manual

1. Crear una pregunta Tabla en un formulario de actividad y otra en una encuesta de cierre de sesión. Comprobar que se abre la ventana de configuración.
2. Escribir encabezados, agregar y eliminar filas/columnas, guardar, volver a editar y verificar que conserva la definición.
3. Guardar el formulario como plantilla y usarlo en otra actividad o sesión.
4. Como colaborador, abrir la vista previa, completar parcialmente, cerrar y reabrir: el borrador permanece mientras el formulario siga montado. El envío debe bloquearse hasta completar todas las celdas.
5. Completar la tabla, repetir texto en dos celdas y enviarla. Consultar nuevamente las respuestas como colaborador y consultor.
6. Exportar resultados CSV/Excel y comprobar la relación entre encabezados y respuestas. Probar también desde un celular: la tabla se desplaza horizontalmente dentro de la ventana.
7. Verificar que el cierre de sesión conserva el avance 80/20 y el bloqueo de cambios posterior al 100%.

Los borradores locales no enviados no se guardan en servidor al recargar o salir de la página, igual que los demás tipos de pregunta.
