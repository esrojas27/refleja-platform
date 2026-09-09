# RTI-VS1-009 — Create Program End-to-End

Estado: cerrado para desarrollo local. Implementación y verificación automática
completas; el usuario confirmó la validación manual del recorrido. No se inicia
RTI-VS1-010 ni se declara completo VS1.

Se revisaron Product Definition, ADR-001 a ADR-005 y el ticket 009 del
[documento canónico](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit?tab=t.s1fvvog8kpix).
El usuario autorizó guardar el 008 y continuar con el 009: commit previo `b45e0aa`,
worktree limpio al comenzar. No se hizo push.

## Contrato y permisos

| Operación | Ruta | Resultado |
| --- | --- | --- |
| POST | `/api/v1/organizations/{organizationId}/programs` | 201, Location del detalle, UUIDv7, DRAFT, version 0 |
| GET | `/api/v1/organizations/{organizationId}/programs` | 200, items/page/size/totalElements/totalPages |
| GET | `/api/v1/organizations/{organizationId}/programs/{programId}` | 200, DTO directo o 404 |

Creación acepta `name`, `description`, `startDate`, `endDate`. Devuelve `id`,
`organizationId`, `name`, `description`, `status`, `startDate`, `endDate`, `version`.
El cliente no puede elegir ID, tenant efectivo, estado, versión ni consultor principal.
El tenant de la URL se valida; la asignación de consultor principal queda nula.

Nombre obligatorio, recortado, 1–255 caracteres y sin controles. Descripción
opcional, máximo técnico de 10000 caracteres y sin NUL. Fechas obligatorias de
calendario ISO, años 0001–9999; inicio <= fin, permitiendo el mismo día. No se
impone duración comercial, fechas futuras ni transiciones de estado.

La base existente admite fechas nulas; no se alteraron sus migraciones para imponer
retroactivamente obligatoriedad. La nueva operación exige ambas fechas en dominio
y entrada. El detalle conserva compatibilidad con registros anteriores sin fechas.

Paginación: page >= 0, size 1–100 (20 por defecto), page*size <= 2147483647 por
límite técnico del offset JPA. Orden fijo `id DESC`, apoyado por el índice único
existente `(organization_id, id)`. No hay filtros ni orden dinámico. Items y totales
se consultan siempre por tenant autorizado, sin cargar todos los programas.

| Contexto activo en la organización destino | Crear | Listar/detalle básico |
| --- | --- | --- |
| CONSULTANT | Sí | Sí |
| COMPANY_ADMIN / LEADER | No: 403 | Sí, sólo metadata del programa según ADR-003 §82 |
| Sólo COLLABORATOR / SUPER_ADMIN / sin rol | No: 403 | No: 403 en este incremento |
| Usuario interno desconocido o no ACTIVE | 403 | 403 |
| Membresía/organización no ACTIVE, ausente o ajena | 404 | 404 |
| Sin Access Token válido | 401 | 401 |

No se conceden permisos globales al operador ni se combinan roles de organizaciones
distintas. LEADER no recibe información de participantes ni ampliación de su scope
individual. El acceso propio de colaboradores inscritos pertenece al 011; no se
implementa anticipadamente. Estos endpoints no sustituyen `/me/programs` futuro.

## Implementación

- `Identity` expone la API interna `OrganizationAccess`, que reutiliza la resolución
  PostgreSQL existente en cada solicitud y entrega sólo userId, organizationId y
  roles inmutables. No expone repositorios, JPA ni datos personales.
- `Program` posee dominio, policy, servicio transaccional, abstracción `Programs`
  y adaptador JPA. Dependencia pública Program → Identity → Organization sin ciclos;
  los tests de Spring Modulith siguen pasando.
- Creación transaccional con el generador UUIDv7 y @Version existentes. Lecturas
  por `(organizationId, programId)`; nunca un findById sin scope.
- Controllers delgados, DTOs explícitos y anotaciones OpenAPI. Errores sanitizados
  `code/message/requestId/errors`, HTTP 400/401/403/404/409/500. Respuestas no-store
  y correlación X-Request-ID. No se amplía el acceso público a Swagger.
- Log operacional de creación después de commit, sin nombre/descripcion/tokens;
  denegaciones de policy correlacionadas. No se crea almacén de auditoría.
- Next.js: listado, creación y detalle en `/organizations/[organizationId]/programs`.
  Enlace desde Cuenta para el tenant seleccionado. Interfaz mínima responsive,
  estados de carga/error/vacío, paginación, formulario y lectura de datos reales.
- Cancelación al desmontar, bloqueo de doble envío pendiente y sin reintento
  automático de POST. Resultado de red incierto exige revisar listado antes de
  repetir. Dos POST independientes válidos pueden crear dos programas.

No hay nuevas dependencias o versiones, migraciones, tablas, bootstrap, variables,
infraestructura AWS, RLS del 012, participantes, invitaciones, dashboards, sesiones,
actividades, edición o activación de programas. Se reutiliza el stack fijado en
pom.xml y package-lock.json, sin reinstalación necesaria.

## Archivos

- Backend Identity: `OrganizationAccess`, `ResolveOrganizationAccess`.
- Backend Program: `domain/{NewProgram,InvalidProgramInput}`;
  `application/{ProgramAccessPolicy,ProgramService,Programs,ProgramData,ProgramPage,ProgramNotFound}`;
  `api/{ProgramController,ProgramErrorHandler}`; `infrastructure/persistence/JpaPrograms`
  y cambios puntuales en `ProgramJpaEntity`/`ProgramJpaRepository`.
- Seguridad raíz: sólo habilitación autenticada de las tres rutas nuevas.
- Web: tres páginas dinámicas, `components/programs/program-area.tsx`,
  `lib/programs/program-api.ts`, enlace de `account-session.tsx`.
- Tests: `NewProgramTest`, `ProgramIntegrationTests`, `program-api.test.ts`,
  `program-area.test.tsx`, `e2e/programs.spec.ts`.
- Documentación: README, plan de implementación y esta acta.

## Verificación

Backend: **113 pruebas**, sin fallos ni omisiones, incluidas 35 nuevas (28 de
integración y 7 de dominio). PostgreSQL real en Testcontainers; fixtures y pruebas
de permisos no modifican la base de desarrollo. Se comprueba creación, UUIDv7,
version, fechas, lectura, paginación, límites, roles, revocación, usuario/organización
inactivos, manipulación de campos y claims, inexistencia y acceso cross-tenant.

Frontend: **47 pruebas** correctas, incluidas 18 nuevas; lint y build de producción
correctos con TypeScript y las tres rutas dinámicas. Scripts locales: **13 pruebas**
existentes correctas. No se desactivaron checks ni se cambiaron versiones.

Playwright: **7 smoke tests correctos** contra el build de producción en 3100,
incluidas las tres rutas nuevas sin sesión en 375 × 667, sin overflow horizontal.
Esto no equivale a un E2E autenticado con Cognito real. El JAR empaquetado inició
en 8084: health 200 y `/me`, crear/listar/detalle de programas sin token respondieron
401. La comprobación no realizó escrituras de negocio y detuvo su propio JAR.
El servidor web temporal también se detuvo al finalizar las pruebas.

Comandos desde apps/api (ajustes temporales de memoria, sin cambiar POM):

```powershell
$env:MAVEN_OPTS = '-Xms32m -Xmx192m -XX:ActiveProcessorCount=2 -XX:+UseSerialGC -XX:ReservedCodeCacheSize=64m'
mvn.cmd '-DargLine=-Xms32m -Xmx384m -XX:ActiveProcessorCount=2 -XX:+UseSerialGC -XX:ReservedCodeCacheSize=64m' verify
```

Desde apps/web:

```powershell
npm.cmd test -- --maxWorkers=1
npm.cmd run lint
npm.cmd run build
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3100'
npm.cmd run test:e2e -- --workers=1
```

En raíz: `node --test scripts/dev.test.mjs scripts/bootstrap-operator.test.mjs`,
`git diff --check`, revisión de archivos nuevos y estado Git.

## Criterios de aceptación

| Criterio del 009 | Evidencia |
| --- | --- |
| Consultant autorizado crea Program | Integración JWT real firmado + PostgreSQL, matriz por rol |
| Organization dentro de scope | Contexto resuelto en cada request; prueba multiorganización |
| startDate <= endDate | Dominio, API y formulario; igualdad permitida |
| Estado inicial DRAFT | Respuesta y persistencia verificadas |
| UUIDv7 | UUID devuelto version() == 7 |
| 201 Created | Integración HTTP y Location del detalle |
| Listar Programs | Paginación y totales exclusivamente del tenant |
| Consultar detalle | Readback de la creación y búsqueda por tenant + ID |
| Next.js crea Program | Pruebas de formulario/cliente y aceptación manual confirmada |
| Next.js lista Programs | Pruebas de datos, vacío y paginación y aceptación manual confirmada |
| Cross-tenant inaccesible | A → programa B devuelve 404 con ambas variantes de URL |

## Aceptación manual y procedimiento de repetición

Tras recibir el recorrido de validación (selección de organización, creación,
estado DRAFT, listado, detalle y persistencia tras recargar), el usuario confirmó:
«Listo todo comprobado». Se registra esta confirmación como aceptación manual del
009. Los status HTTP, UUIDv7, matriz de permisos y rechazo cross-tenant mantienen
como evidencia las pruebas automáticas; no se atribuye al usuario una inspección
adicional de Network o escenarios de seguridad que no detalló.

Para repetir la validación:

1. Ejecutar `./dev.cmd`, login y **Comprobar sesión** en Cuenta.
2. Seleccionar la organización creada en el 008 y pulsar **Ver programas**.
3. **Crear programa** con datos de una prueba identificable y fechas válidas.
4. Confirmar mensaje de creación, DRAFT y version 0. En Network, comprobar POST
   201 y GET de detalle 200, sin compartir tokens en capturas.
5. Volver al listado, abrir el programa y recargar: deben conservarse los datos.
6. Seleccionar otra organización desde Cuenta: el listado no debe mezclar programas.
7. Probar fechas invertidas: debe impedirse la creación.

La selección de otra organización propia no es por sí sola una prueba de acceso
no autorizado: el caso cross-tenant con un usuario sin membresía está automatizado.
No se inventó un programa en la base local para simular aceptación. No hay decisiones
arquitectónicas pendientes para cerrar el 009. Este registro de cierre modifica
sólo documentación: no se repitieron pruebas de código ni se alteraron datos.
El usuario autorizó conservar el cierre del 009 en un commit independiente y
publicarlo junto con los commits locales previos antes de comenzar el 010.
