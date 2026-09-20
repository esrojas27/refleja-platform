# Perfil inicial del colaborador

## Alcance

Un colaborador con membresía activa debe completar su perfil antes de utilizar sus
programas. El incremento no introduce registro público, aprobación manual del
perfil, carga de archivos, DISC ni administración de perfiles por terceros.

El formulario solicita:

- nombre completo;
- fecha de nacimiento;
- teléfono;
- ciudad;
- país;
- cargo.

El correo se obtiene del usuario interno autenticado y la empresa de la organización
seleccionada. Ambos se muestran como información de contexto y el cliente no puede
modificarlos.

## Modelo y autorización

Los datos personales —nombre completo, fecha de nacimiento, teléfono, ciudad y
país— pertenecen al usuario global. El cargo y `profile_status` pertenecen a la
membresía de organización, porque pueden variar entre empresas. El estado se guarda
por nombre simbólico y sólo admite `PENDING` o `COMPLETE`.

`ACTIVE` continúa describiendo la vigencia de la membresía; no implica que el perfil
esté completo. El backend resuelve siempre el usuario por el `sub` del Access Token,
valida una membresía activa con rol `COLLABORATOR` y no acepta identificadores de
usuario enviados por el navegador.

Una membresía colaboradora `PENDING` puede consultar y actualizar su propio perfil,
pero queda excluida de la resolución de acceso a programas y actividades. Al guardar
datos válidos, el backend persiste los campos y cambia el estado a `COMPLETE` en una
sola transacción. El perfil completo puede volver a editarse.

## Contrato HTTP

- `GET /api/v1/me/profile?organizationId=<uuid>` devuelve el perfil propio.
- `PUT /api/v1/me/profile?organizationId=<uuid>` valida y guarda los seis campos
  editables; correo, empresa, membresía, rol y estado no forman parte de la entrada.
- Las respuestas usan `Cache-Control: no-store`.
- Una identidad sin la membresía colaboradora solicitada no recibe el perfil.

La fecha de nacimiento debe ser anterior a la fecha actual. Todos los campos son
obligatorios; el teléfono admite números y separadores telefónicos comunes, y los
textos tienen límites de longitud aplicados en la API.

## Experiencia web

`/account` informa el estado del perfil y redirige al colaborador pendiente a
`/profile?organizationId=<uuid>`. La ruta `/my-programs` incorpora una barrera de
experiencia equivalente, mientras que el backend mantiene la garantía real de
autorización. Una vez guardado el perfil, la interfaz ofrece acceso a **Mis
programas**. Cuenta, Mi perfil, Invitaciones y el listado Mis programas comparten una
navegación lateral responsive con destinos y acciones identificados por iconos;
el detalle de un programa conserva su navegación contextual propia. La tarjeta personal muestra **Perfil
verificado** con un distintivo verde cuando la membresía colaboradora activa está
`COMPLETE`; un estado `PENDING` conserva una advertencia diferenciada.

## Validación manual

1. Iniciar sesión con un colaborador que haya aceptado su invitación y cuyo perfil
   esté `PENDING`.
2. En **Cuenta**, seleccionar su organización o pulsar **Comprobar sesión**.
3. Verificar la redirección a **Perfil del colaborador** y que correo y empresa se
   muestren sin campos editables.
4. Confirmar que intentar abrir `/my-programs` vuelve al perfil pendiente.
5. Completar los seis campos y guardar.
6. Verificar el mensaje **Perfil completo** y abrir **Mis programas**.
7. Volver a **Cuenta** y confirmar el estado completo y el acceso disponible.

## Límites

No se define una edad mínima, validación externa del teléfono o catálogo de países
y ciudades. Tampoco se implementan aprobación manual, exportación, eliminación o
retención especial de estos datos; esas decisiones de privacidad requieren un
alcance posterior.
