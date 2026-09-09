# RTI-VS1-007 — Acta de aceptación

**Estado: COMPLETE — alcance del ticket validado localmente.**
Fecha: 2026-09-08 (America/Bogota).

Fuente: [backlog VS1](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit?tab=t.s1fvvog8kpix)
y [ADR-001 a ADR-005](../adr/README.md). No implica cierre de VS1 ni inicio del 008.

## Implementación y decisiones aprobadas

`JWT.sub` validado por Spring Security resuelve un usuario interno y sus membresías
y roles de PostgreSQL. `IdentityContextService` construye un `AuthenticatedPrincipal`
inmutable por consulta con `userId`, `cognitoSubject`, organización activa y roles.
El JWT sigue siendo la autenticación externa de Spring; el principal interno no
es un JWT nuevo ni se conserva en una sesión o caché de autorización.

- Usuario interno inexistente, `INVITED`, `SUSPENDED` o `DEACTIVATED`: `403`, sin
  crearlo ni activarlo automáticamente. Sólo `ACTIVE` obtiene contexto.
- Sólo membresías `ACTIVE` de organizaciones `ACTIVE` forman el contexto disponible.
- Sin organizaciones: perfil disponible, lista/roles vacíos y selección nula.
- Una organización disponible se selecciona automáticamente; con varias se requiere
  selección explícita. Los roles activos nunca son la unión de distintas membresías.
- Cada llamada relee PostgreSQL; la revocación o eliminación de un rol se refleja
  en la siguiente consulta. `hasRole` exige la organización seleccionada correcta.
- El `sub` es el vínculo canónico. Email, Cognito Groups y claims de organización
  no sustituyen la identidad o autorización interna.

Estas reglas de usuario y selección fueron aprobadas expresamente por el usuario.
La lectura JDBC utiliza dependencias existentes y el modelo de lectura permitido
por ADR-004. `identity` sólo consulta sus tablas y usa la API pública
`organization.OrganizationDirectory` para obtener nombres y estados de organizaciones;
no consulta tablas de otro módulo ni importa sus repositorios/entidades privadas.

## Contrato HTTP y frontend

`GET /api/v1/me[?organizationId=<uuid>]` conserva `cognitoSubject` y devuelve:

- `user`: `id`, `email`, `firstName`, `lastName` (los nombres pueden ser nulos).
- `organizations`: lista de `{id, name, roles}` disponibles para el usuario.
- `activeOrganizationId`: UUID seleccionado o `null`.
- `roles`: exclusivamente los de la organización activa, o lista vacía.

La selección no se persiste y no otorga permisos por sí misma. UUID inválido: `400`;
sin JWT válido: `401`; sin acceso interno: `403`; organización ajena, desconocida o
no disponible: `404` genérico. Los errores propios de `/me` usan `code`, `message`,
`requestId` y `X-Request-ID`; perfil y errores del controlador usan `Cache-Control: no-store`.
Health sigue público y no se habilitan endpoints de negocio adicionales.

La pantalla mínima de cuenta muestra el perfil y contexto devuelto; con varias
organizaciones permite pedir una selección al backend. Distingue ausencia de sesión,
acceso interno denegado, organización no disponible y fallo de servicio. Limpia el
contexto previo al consultar/cerrar sesión y descarta respuestas tardías canceladas.
No se añadieron dependencias ni se cambiaron sus versiones.

## Criterios de aceptación

| Criterio oficial | Evidencia |
| --- | --- |
| Cognito sub resuelve User interno | Consulta parametrizada por sub; prueba conocida y recorrido manual positivo. |
| User con múltiples memberships | Dos organizaciones en prueba de integración. |
| Membership con múltiples roles | LEADER y COLLABORATOR recuperados desde PostgreSQL en la misma membresía. |
| Sólo membership ACTIVE otorga acceso | PENDING, SUSPENDED y REVOKED excluidas; selección rechazada. |
| Membership REVOKED no otorga acceso | Revocación seguida de nueva consulta sin acceso; organización solicitada devuelve 404. |
| Deny-by-default | Usuario inexistente/inactivo rechazado, organización ajena no seleccionable y rutas no habilitadas denegadas. |
| Roles proceden de PostgreSQL | Cambios en filas de roles se reflejan en la siguiente consulta, no en claims de Cognito. |
| Frontend no es fuente de autorización | Selección validada por servicio; claims manipulados no conceden roles; UI sólo consume DTO. |
| /me devuelve información del usuario | DTO de perfil; prueba de integración, componente y captura manual. |
| /me devuelve organizaciones disponibles | Listas vacía, individual y múltiple probadas; filtra estado de membresía y organización. |
| Usuarios multiorganización | Selección explícita, roles separados y prueba de componente del selector. |

## Verificación

| Comando o comprobación | Resultado |
| --- | --- |
| `mvn.cmd clean verify` en `apps/api` (implementación) | 38 pruebas; 0 fallos, errores u omisiones. PostgreSQL 18/Testcontainers y verificación Modulith. |
| `npm.cmd run lint` en `apps/web` | Correcto. |
| `npm.cmd test -- --maxWorkers=1` | 17 pruebas en 4 archivos, todas correctas en la repetición completa. |
| `npm.cmd run build` | Correcto; TypeScript y prerender de `/`, `/login`, `/account`. |
| Playwright contra `next start` del build, puerto 3100 | 3 smoke tests correctos, incluidos render responsive, login y estructura de cuenta. |
| `git diff --check` | Sin errores de whitespace; avisos de conversión LF/CRLF de Windows. |

Revalidación previa a publicar (2026-09-08): `mvn.cmd verify` se interrumpió por
falta de memoria nativa de la JVM tras las dos pruebas de arquitectura. Se repitió
con `MAVEN_OPTS=-Xmx256m` y `mvn.cmd '-DargLine=-Xmx512m' verify`; la JVM volvió a
fallar por memoria antes de ejecutar pruebas. Estas dos ejecuciones **no** se
consideran aprobadas ni sustituyen la evidencia previa de 38 pruebas correctas.
Durante la preparación de esta publicación sólo se modificó documentación; no se
cambiaron el código, las aserciones ni la configuración permanente para eludir el
fallo. Repetir la suite con memoria disponible antes del siguiente incremento.

El primer intento de Vitest terminó con 16 pruebas correctas y un timeout al
arrancar el worker restante; no se consideró una suite aprobada. La repetición
completa pasó sin cambiar límites ni aserciones. El Playwright que inicia `next dev`
agotó los 120 segundos de arranque; Next reportó lentitud del sistema de archivos.
La repetición usó el build de producción, sin cambiar los tests ni la configuración
permanente. El servidor temporal se detuvo al terminar.

Para repetir los smoke tests de producción, tras el build, usar dos terminales
desde `apps/web` (puerto 3100 libre):

```powershell
# Terminal 1; detener con Ctrl+C al finalizar
npm.cmd run start -- --hostname 127.0.0.1 --port 3100
```

```powershell
# Terminal 2
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3100'
npm.cmd run test:e2e -- --workers=1
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

Los 15 casos nuevos de integración cubren usuario conocido/ausente, estados de
usuario, membresía y organización, múltiples roles/membresías, cambios de permisos,
organización ajena/desconocida y UUID inválido. La suite de autenticación existente
mantiene validación de JWT y errores 401/403; se actualizó su caso exitoso al DTO del 007.
Los componentes y cliente prueban también la separación de errores y las respuestas
tardías después del logout. No son pruebas de login OAuth real automatizado.

## Aceptación manual y datos locales

El usuario confirmó con capturas el acceso denegado `403` con sesión Cognito válida,
el logout y la ausencia de identidad posterior. Después autorizó expresamente crear
su usuario interno local. Se verificaron cuenta AWS de desarrollo, pool, usuario
Cognito habilitado/confirmado, email verificado y su `sub` antes del INSERT.

Se insertó exactamente una fila de `rti.users`: UUIDv7, estado `ACTIVE`, versión `0`,
email normalizado y timestamps; nombres opcionales nulos. Se comprobó el COMMIT,
el vínculo con Cognito y cero membresías. No se asignaron roles ni organizaciones,
no se cambió Cognito y no se guardaron contraseñas/tokens en PostgreSQL.
El registro pertenece exclusivamente al volumen local, no es una migración ni
un seed distribuido. Esta acta no publica identificadores personales ni credenciales.

El usuario mostró luego la pantalla con sesión autenticada, el perfil del usuario
creado y la respuesta con `organizations: []`, `activeOrganizationId: null` y
`roles: []`. Confirma el caso positivo sin acceso organizacional. Los escenarios
multiorganización se validaron automáticamente, no con organizaciones reales creadas
para esta aceptación. No se requiere crear datos ficticios para dar por cerrado el 007.

## Límites y punto de continuación

- No hay nuevas migraciones, entidades, dependencias, recursos AWS ni CI/CD.
- No se ha implementado crear organizaciones/programas, invitaciones o dashboards.
- El usuario creado no tiene permisos de primer operador. Sigue pendiente el
  mecanismo explícito de la sección 14 del backlog antes de comenzar el 008.
- No existe bootstrap reproducible de usuarios en una instalación limpia;
  no confundir este aprovisionamiento manual con una funcionalidad del producto.
- El contexto actual protege `/me`; no implica RLS ni autorización automática de
  futuros endpoints. Cada futuro caso de uso debe comprobar sus permisos y tenant.
- Validación local, no despliegue de web/API/BD ni aceptación de producción.
- La última repetición backend quedó limitada por memoria del equipo; véase el
  resultado explícito anterior. No se detuvieron aplicaciones del usuario.
- La duplicación visual del correo cuando no hay nombre es un detalle cosmético
  pendiente; no afecta identidad o autorización y no se cambió durante este cierre.

Estado frente al MVP y próximos tickets: [plan de implementación](implementation-plan.md).
