# RTI-VS1-008 — Create Organization End-to-End

Estado: cerrado para desarrollo local; verificación automática completa y
aceptación manual confirmada por el usuario con su sesión real. No se declara
cerrado VS1 ni se inicia RTI-VS1-009.

## Decisión humana y autorización

El usuario aprobó que inicialmente sólo los consultores activos de la organización
operadora real **Refleja Tu Interior** puedan crear organizaciones. El creador
recibe una membresía activa con `CONSULTANT` exclusivamente en la nueva organización.
Es una política específica de este ticket, dentro del modelo de memberships de
ADR-003; no un rol global ni una puerta de acceso productiva de bootstrap.

Se revisaron la definición de producto, ADR-001 a ADR-005 y las secciones 13–14 del
[backlog canónico](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit?tab=t.s1fvvog8kpix).
El bootstrap previo quedó separado en el commit `8620d70` y el worktree estaba
limpio al comenzar el 008.

`OPERATOR_ORGANIZATION_ID` es configuración backend por entorno. Se establece con
el UUID de la organización verificada administrativamente, nunca a partir de su
nombre, del usuario que hace login ni de una request. Vacío deniega la creación;
malformado falla al iniciar. No se expone como variable `NEXT_PUBLIC_*`.

| Condición del solicitante | Crear organización |
| --- | --- |
| Sin Access Token válido | 401 |
| Usuario interno inexistente o no ACTIVE | 403 |
| Organización operadora o membresía no ACTIVE | 403 |
| CONSULTANT activo de la operadora configurada | Permitido |
| CONSULTANT de otra organización, incluso con el mismo nombre | 403 |
| Sólo COMPANY_ADMIN, LEADER, COLLABORATOR o SUPER_ADMIN | 403 |
| Roles Cognito, IDs o roles manipulados desde el navegador | No conceden acceso |

El permiso se consulta en PostgreSQL en cada request. Revocar la membresía o
eliminar el rol afecta la siguiente request, incluso con el mismo JWT.
`canCreateOrganizations` en `/me` es una capacidad para UX independiente de la
selección actual; no combina los roles de los tenants. El POST vuelve a comprobarla.

## Implementación y contrato

- `POST /api/v1/organizations`: acepta únicamente `name` y `defaultTimeZone` como
  campos efectivos. Campos adicionales no se mapean a entidades ni conceden acceso.
- Nombre no vacío, hasta 255 caracteres, sin caracteres de control; se recortan
  espacios exteriores. Zona horaria nombrada admitida por Java/IANA, no un offset
  fijo. Son límites técnicos de entrada; no se impone unicidad del nombre.
- Respuesta directa `201`: `id`, `name`, `status`, `defaultTimeZone`, `version`.
  Estado inicial `ACTIVE`, UUIDv7, versión `0`. Slug y logo no se generan.
- Una transacción crea organización, membresía y rol. Un fallo revierte las tres
  escrituras. `Organization` posee su dominio y persistencia; `Identity` orquesta
  el acceso y membresías mediante `OrganizationRegistration`, API interna sin
  entidades JPA ni repositorios compartidos. No hay dependencia cíclica.
- Errores sanitizados con `code`, `message`, `requestId` y lista `errors` cuando
  corresponde: 400 validación, 401 autenticación, 403 permiso, 409 conflicto,
  500 fallo inesperado. Respuestas sin caché; correlación `X-Request-ID`.
- Anotaciones OpenAPI documentan operación, autenticación, request, respuesta y
  errores. No se amplió la exposición pública de Swagger.
- `/organizations/new`: formulario responsive y mínimo, confirmación con datos
  reales de la respuesta y enlace a Cuenta. `/account` muestra el enlace sólo
  cuando `/me` confirma el permiso. La UI no es una frontera de seguridad.
- El cliente usa Access Token, admite cancelación, impide doble envío pendiente
  y no reintenta automáticamente un POST. Ante resultado de red incierto indica
  comprobar la cuenta antes de repetir. No se implementaron idempotency keys;
  dos POST independientes válidos pueden crear dos organizaciones.
- Auditoría operacional del caso de uso: creación confirmada después del commit
  con actor, organización, rol, requestId y fecha; denegación de política sin
  contenido sensible. No se creó un módulo o almacén de auditoría completo.

No hay nuevas dependencias, cambios de versiones, tablas, migraciones, endpoints
de programas, invitaciones, RLS del 012, infraestructura AWS ni CI/CD.

## Pruebas y comandos

Backend: **78 pruebas correctas**, incluidas 25 de integración nuevas de creación,
12 de dominio y 3 de política. Se prueba persistencia PostgreSQL real, UUIDv7,
perfiles/roles no autorizados, revocación, suplantación por nombre/claims,
acceso de otro usuario a la nueva organización mediante `/me`, validación,
rollback tras fallo de membresía, CORS y compatibilidad del contexto anterior.
Los tests destructivos de fixtures actúan sólo sobre Testcontainers, no sobre la
base de desarrollo. Los límites de Spring Modulith siguen pasando.

Frontend: **29 pruebas correctas**, lint y build de producción correctos.
**4 smoke tests Playwright correctos** contra el build de producción, incluida
la nueva ruta sin sesión y en viewport de 375 × 667. La captura de esta ruta fue
inspeccionada. No equivalen a un E2E autenticado con Cognito real.

Comandos desde `apps/api` (ajustes temporales por memoria, no cambios del POM):

```powershell
$env:MAVEN_OPTS = '-Xms32m -Xmx384m -XX:ActiveProcessorCount=2 -XX:+UseSerialGC -XX:ReservedCodeCacheSize=64m'
mvn.cmd '-DforkCount=0' verify
```

Las dos primeras ejecuciones con JVM separada fallaron antes de ejecutar tests por
falta de memoria nativa. La ejecución anterior sí completó todas las pruebas y
empaquetó el JAR; no se deshabilitaron tests ni aserciones.

La repetición final también pasó las **78 pruebas con JVM separada** y build
correcto, usando una memoria inicial pequeña:

```powershell
$env:MAVEN_OPTS = '-Xms32m -Xmx192m -XX:ActiveProcessorCount=2 -XX:+UseSerialGC -XX:ReservedCodeCacheSize=64m'
mvn.cmd '-DargLine=-Xms32m -Xmx384m -XX:ActiveProcessorCount=2 -XX:+UseSerialGC -XX:ReservedCodeCacheSize=64m' verify
```

En la raíz también pasaron las 13 pruebas de scripts existentes:
`node --test scripts/dev.test.mjs scripts/bootstrap-operator.test.mjs`.

Desde `apps/web`:

```powershell
npm.cmd test -- --maxWorkers=1
npm.cmd run lint
npm.cmd run build
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100
# En otra terminal, mientras ese servidor temporal está activo:
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3100'
npm.cmd run test:e2e -- --workers=1
```

No se reinstalaron dependencias: las existentes permitieron compilar, probar y
construir sin cambios en lockfiles. Se revisó `git diff --check` y el estado de Git.

También se inició temporalmente el JAR empaquetado en `127.0.0.1:8084`, con la
configuración local y el UUID operador comprobado: health 200, `/me` sin token 401
y POST de organizaciones sin token 401. El proceso se detuvo al completar las
comprobaciones; no realizó escrituras de negocio. El servidor web de pruebas en
3100 también se detuvo. Se preservaron los servicios que el usuario tenía abiertos.

## Archivos del incremento

- Backend `identity`: controlador y handler de creación, caso de uso
  `CreateOrganization`, `OrganizationCreationPolicy`, `CreatorMemberships` y su
  adaptador JPA; actualización de `MeController` y `MeResponse` para la capacidad.
- Backend `organization`: API interna `OrganizationRegistration`, error público
  `InvalidOrganizationInput`, dominio `NewOrganization` y adaptador JPA de registro.
- Configuración: `ActuatorHealthSecurityConfiguration`, `application.yml`,
  `.env.example` y `scripts/dev.mjs`; UUID real sólo en `.env` local ignorado.
- Web: página `organizations/new`, `create-organization-form`, cliente
  `create-organization`, y enlace/capacidad en `account-session` y `authenticated-api`.
- Tests: `NewOrganizationTest`, `OrganizationCreationPolicyTest`,
  `OrganizationCreationIntegrationTests`, `create-organization-form.test.tsx`,
  `create-organization-api.test.ts` y `organization-creation.spec.ts`.
- Documentación: README raíz, plan de implementación y esta acta.

## Criterios de aceptación

| Criterio | Evidencia |
| --- | --- |
| Autenticación obligatoria | Tests 401 con token ausente/inválido |
| Autorización para crear | Política aprobada y matriz probada en PostgreSQL |
| UUIDv7 | Verificado en organización y membresía persistidas |
| Estado inicial válido | ACTIVE comprobado en API y BD |
| Zona horaria establecida | Validación de dominio y Europe/Madrid persistida |
| Operador puede administrar la nueva organización | Membresía ACTIVE y CONSULTANT; `/me` la ofrece |
| Respuesta incluye version | 201 con version 0 |
| Errores ADR-005 | Status/códigos/requestId; sin SQL ni detalles internos |
| Formulario Next.js funcional | Tests de envío, validación, permisos, duplicados y errores |
| Organización aparece en UI | Usuario confirmó creación, aparición en su cuenta y selección con CONSULTANT |
| No expone JPA entity | DTOs explícitos y API interna sin entidades |

## Aceptación manual y procedimiento de repetición

El usuario confirmó expresamente que creó una organización desde la aplicación,
que ésta aparece en la cuenta del usuario que la creó y que puede seleccionarla
con el rol `CONSULTANT`. Esta confirmación completa el recorrido manual del 008.
La evidencia de HTTP 201, UUIDv7 y version 0 corresponde a las pruebas automáticas;
no se atribuye al usuario una inspección adicional de Network que no reportó.

Para repetir la validación:

1. Verificar `OPERATOR_ORGANIZATION_ID` en `.env` raíz con el UUID de la operadora
   real. El ajuste local de esta instalación ya fue aplicado; no está en Git.
2. Detener el arranque previo con Ctrl+C y ejecutar `./dev.cmd` para cargar el código
   y configuración actuales. No es necesario borrar datos ni repetir el bootstrap.
3. Login con el operador; en `/account`, **Comprobar sesión** y **Crear organización**.
4. Introducir una organización de prueba identificable y su zona horaria. Confirmar
   en Network `POST /api/v1/organizations` → 201, con UUID, ACTIVE y version 0.
5. Volver a Cuenta y comprobar la sesión: debe aparecer la organización nueva en
   el selector. Al seleccionarla, el rol debe ser CONSULTANT.

No compartir tokens ni credenciales en capturas. No se creó una empresa ficticia
en la base local para simular esta aceptación. Las organizaciones de fixtures
sólo existieron en la base efímera de tests. La organización de aceptación fue
creada por el usuario mediante el flujo real. El 008 queda cerrado para su alcance
local; el 009 se podrá considerar después, sin iniciarlo automáticamente.

El cierre de este ticket se conserva en un commit independiente antes de iniciar
el 009, por autorización del usuario. No se publica con push. No hay decisiones
arquitectónicas pendientes adicionales a la política ya aprobada.
