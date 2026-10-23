# Registro de personas y envío de invitaciones

## Flujo de producto

1. El consultor abre **Personas del programa** y usa **Agregar persona**.
2. La inscripción queda registrada, con invitación **Sin enviar**. Puede seguir
   preparando la lista sin enviar ningún correo.
3. **Enviar Invitaciones** pide confirmación y procesa las invitaciones pendientes
   del programa completo, no solamente la página visible.
4. Se muestran cantidades con envío confirmado por el proveedor, fallidas y en curso.
   Cada destinatario recibe su propio correo; no se exponen los demás destinatarios.
   Al terminar aparece un aviso emergente con entrada suave: el éxito se cierra a
   los ocho segundos (se pausa al pasar el cursor o enfocar el aviso). Las
   advertencias permanecen hasta cerrarlas; no se muestra éxito si hay fallos
   o envíos en curso. Se respeta la preferencia de movimiento reducido.
   Los correos con envío no confirmado quedan en una sección persistente del
   resultado del lote, incluso si están en otra página, y la tarjeta de cada
   persona muestra una etiqueta de advertencia. Un reintento confirmado quita
   esa persona del detalle al actualizar su página.
5. Repetir la acción procesa pendientes o fallos y omite envíos ya confirmados.
   También se mantiene el reintento individual de un envío fallido.

Aplica a Colaborador, Líder y RRHH. Reincorporar una invitación revocada o vencida
también prepara una nueva invitación sin enviarla automáticamente.

## Contratos y seguridad

- `POST .../enrollments` crea la inscripción y una invitación `DRAFT`.
  Cognito puede crear la cuenta con `SUPPRESS`, sin bienvenida ni contraseña enviada.
  No se llama a SES. La membresía nueva sigue pendiente; no se activa el acceso.
- `POST .../enrollments/invitation-delivery` solicita el lote explícitamente.
  Requiere consultor de esa organización y programa editable. Incluye las
  inscripciones invitadas existentes al comenzar la operación, en orden estable.
  La respuesta añade `failures: [{enrollmentId, email}]`, solamente con los
  destinatarios cuyo envío no pudo confirmarse en ese lote y en ese programa.
  No expone errores internos del proveedor ni registra correos en la auditoría.
  El frontend acepta también respuestas anteriores sin `failures` o con valor
  nulo, normalizándolas a una lista vacía; no interpreta la ausencia del detalle
  como un fallo del envío ni permite guardar una lista indefinida en la vista.
  Los contadores inválidos se presentan como resultado no confirmado, sin reintento
  automático. Volver a enviar un lote ya enviado sigue siendo una operación sin
  nuevos correos y se informa como lista actualizada, no como un nuevo éxito de envío.
- El lote vuelve a verificar permisos y estado del programa entre destinatarios.
  Omite inscripciones retiradas o deshabilitadas e invitaciones aceptadas,
  revocadas, vencidas o con envío confirmado.
- Los borradores no aparecen en el listado del colaborador ni se pueden aceptar
  por identificador directo. No tienen vencimiento. Al iniciar el primer envío,
  pasan a `PENDING` y comienza su vigencia de siete días; reintentar no la extiende.
- Para cuentas nuevas, el mismo envío explícito solicita primero el acceso inicial
  de Cognito y después la bienvenida/invitación de SES. No se almacenan contraseñas.
- Cada envío conserva la exclusión por invitación y el lease de cinco minutos.
  Un fallo de un destinatario no revierte ni impide los otros envíos.
- No se modifica ni se reenvía automáticamente ninguna invitación anterior a esta
  migración. Las invitaciones ya enviadas siguen funcionando.

## Alcance operativo

El lote es síncrono y entrega los mensajes individualmente: una sola acción no
garantiza llegada simultánea a todas las bandejas. `SENT` significa aceptación
por el proveedor, no recepción. Si se pierde la respuesta, actualizar el listado
antes de repetir. Los envíos confirmados se omiten; un timeout ambiguo del proveedor
puede causar un correo repetido al reintentar, como en el flujo anterior.
No se incorpora una cola ni infraestructura adicional para el piloto.

Las pruebas usan PostgreSQL desechable y proveedores simulados; no envían correos reales.
Cubren preparación sin correo, privacidad y aceptación, siete días desde el envío,
lotes de más de 20 personas, fallos parciales, reintentos, concurrencia, permisos,
aislamiento entre programas/organizaciones y programas cerrados. El E2E MVP incluye
ahora pulsar **Enviar Invitaciones** y confirmar antes de cambiar al colaborador.
