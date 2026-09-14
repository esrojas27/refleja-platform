# Refleja Tu Interior Platform

Monorepo oficial de la Plataforma Refleja Tu Interior.

El repositorio contiene la base técnica inicial (001–005), autenticación con Cognito
(006), contexto interno y roles (007), creación de organizaciones (008) y programas
(009). La inscripción e invitación de colaboradores (010) está cerrada para
desarrollo local después de validar el recorrido completo con Cognito y SES reales.
La vista de programas propios del colaborador (011) y el aislamiento RLS (012)
están cerrados para desarrollo local. El gate CI y el journey E2E real del 013
ya fueron validados en GitHub con sus tres gates en verde.

## Estructura del repositorio

```text
refleja-platform/
├── apps/
│   ├── web/                 # Aplicación web Next.js y cliente público de Cognito
│   └── api/                 # Spring Boot Resource Server y migraciones Flyway
├── infra/
│   ├── cognito/             # User Pool, app client y dominio de desarrollo
│   └── postgres/init/       # Bootstrap técnico de roles y schema locales
├── docs/
│   ├── adr/                 # Índice de decisiones arquitectónicas
│   └── architecture/        # Plan incremental y actas de aceptación
├── .github/workflows/       # Gate automático del Vertical Slice 1
├── docker-compose.yml       # PostgreSQL local para desarrollo
├── .env.example             # Variables locales de ejemplo, sin secretos reales
├── .gitignore
└── README.md
```

## Arranque local con un comando

Desde la raíz del repositorio, en PowerShell o CMD:

```powershell
.\dev.cmd
```

También puedes ejecutar `node scripts/dev.mjs`. Requiere Node.js 20.9 o posterior,
npm, Java 21, Maven y Docker Desktop con contenedores Linux. Si Docker está detenido,
el script intenta iniciarlo mediante `docker desktop start`.

La configuración inicial se hace una vez: `.env` en la raíz debe contener las tres
contraseñas PostgreSQL y las variables backend de Cognito; `apps/web/.env.local`
debe contener las variables públicas Cognito del ejemplo. Usa los recursos de
desarrollo ya provisionados en `infra/cognito`. El script comprueba que frontend y
backend usen el mismo pool y app client; no provisiona AWS ni crea usuarios.

El comando instala dependencias con `npm ci` en su primera ejecución y cuando
cambian `package.json` o `package-lock.json`, inicia/reutiliza PostgreSQL, arranca
Spring Boot (incluidas las migraciones existentes) y Next.js, y espera respuestas
correctas de health, `/api/v1/me` sin token, `/`, `/login` y `/account`.

- PostgreSQL: reutiliza el puerto publicado del contenedor del proyecto. Si no
  está ejecutándose, prueba `POSTGRES_PORT`, `55432` y `55433`.
- API: prueba `SERVER_PORT` (por defecto `8080`), `8081`, `8082` y `8083`.
- Web: conserva el puerto del callback Cognito; si está ocupado, informa el
  conflicto. No cambia los redirects registrados.
- La URL efectiva de la API y el origen CORS se pasan a los procesos. Las
  credenciales de migración y runtime se cargan de `.env` en sus roles separados.
  No necesitas editar `.env.local` cuando cambia el puerto de la API.

En discos lentos, la primera compilación de Next.js puede tardar varios minutos.
El script muestra el tiempo de espera y permite hasta 600 segundos por comprobación
de API/web. Puedes ajustar `RTI_STARTUP_TIMEOUT_SECONDS` en `.env` (30–1800 segundos).

Mantén abierta la terminal. **Ctrl+C** detiene los procesos API/web iniciados por
el script; PostgreSQL sigue disponible y conserva su volumen. Para detener también
la base: `docker compose stop postgres`. Los logs por ejecución están en
`.local/dev/` (ignorado por Git); el script oculta contraseñas cargadas, Bearer tokens
y parámetros OAuth `code`/`state` en esos logs.

```powershell
.\dev.cmd --smoke    # Arranca, verifica y cierra API/web automáticamente
.\dev.cmd --install  # Fuerza la reinstalación reproducible con npm ci
node --test scripts/dev.test.mjs
```

El smoke comprueba disponibilidad técnica; la autenticación real requiere probar
el login en Cognito con un usuario de desarrollo. Los errores de autenticación OAuth
no se corrigen ni se consideran validados por este script. Si cambias las contraseñas
de `.env` después de inicializar el volumen, debes sincronizar los roles existentes;
el script no reinicializa ni elimina la base para resolver ese error.

## Frontend web

### Programas — RTI-VS1-009

En Cuenta, comprueba tu sesión y selecciona una organización. **Ver programas**
abre su listado; **Crear programa** está disponible para CONSULTANT en esa
organización. Introduce nombre, descripción opcional y fechas de inicio/fin.
El programa se guarda como `DRAFT`; puedes volver al listado y abrir su detalle.
No hay activación, edición ni dashboards en este incremento. La administración de
colaboradores se implementa separadamente en el 010.

API: `POST` y `GET /api/v1/organizations/{organizationId}/programs`, y
`GET /api/v1/organizations/{organizationId}/programs/{programId}`. El listado
usa `page=0&size=20`, máximo 100, y orden fijo por UUID descendente. El backend
valida membresía, estado y roles en cada solicitud. Un UUID conocido no concede
acceso; los recursos cross-tenant responden 404. No se necesitan variables,
dependencias ni migraciones nuevas. [Contrato, pruebas y validación manual](docs/architecture/rti-vs1-009-acceptance.md).

### Colaboradores e invitaciones — RTI-VS1-010

Un `CONSULTANT` activo puede abrir **Colaboradores** desde el detalle de un programa,
registrar nombre, apellido y correo, consultar las inscripciones y reintentar una
entrega fallida. La creación guarda una invitación de siete días y usa la identidad
real de Cognito; no genera contraseñas propias ni las guarda en PostgreSQL.

El colaborador inicia sesión con Cognito y entra a `/invitations`. Sólo puede listar
y aceptar invitaciones asociadas a su propio `sub`. Al aceptar una invitación vigente,
el usuario, la membresía y la inscripción pasan a `ACTIVE`. Una identidad suspendida,
una membresía revocada o una inscripción no disponible no se reactiva implícitamente.

La integración externa permanece deshabilitada por defecto con
`INVITATIONS_ENABLED=false`; sólo se habilita en un entorno después de verificar el
remitente SES. En el sandbox de SES también debe verificarse el destinatario de
prueba. `SENT` indica aceptación de la solicitud por SES, no entrega ni lectura.
Configuración: [Cognito/SES](infra/cognito/README.md#correo-de-invitaciones-rti-vs1-010).
Contrato, seguridad, evidencia automática y recorrido manual:
[acta del 010](docs/architecture/rti-vs1-010-acceptance.md).

### Mis programas — RTI-VS1-011

Una cuenta con usuario, membresía y rol `COLLABORATOR` activos ve **Mis programas**
en `/account`. `/my-programs` muestra únicamente programas respaldados por una
inscripción propia `ACTIVE` o `COMPLETED`; cada elemento abre un detalle básico con
nombre, organización, descripción, estado y fechas.

API: `GET /api/v1/me/programs` y `GET /api/v1/me/programs/{programId}`. El backend
resuelve la persona desde el `sub` del Access Token y no acepta un `participantId`
ni un tenant elegido por el cliente. Programas de otra persona u organización se
ocultan con 404. No se agregaron migraciones ni dependencias. Contrato, seguridad,
pruebas y validación manual: [acta del 011](docs/architecture/rti-vs1-011-acceptance.md).

### Actividades asignadas

Un `CONSULTANT` puede abrir **Actividades** dentro del espacio de trabajo de un
programa, escoger una sesión, definir título, instrucciones y fecha límite, y
asignar la actividad a una o más inscripciones `ACTIVE`. La creación y las
asignaciones se confirman en una sola transacción.

El colaborador ve únicamente sus actividades en el detalle de **Mis programas**.
La API deriva su inscripción del Access Token; no acepta identificadores de
usuario, membresía u organización elegidos por el navegador. Este corte no incluye
entregas, archivos, comentarios, revisión ni progreso. Contrato, persistencia y
recorrido manual: [actividades del programa](docs/architecture/program-activities-foundation.md).

### Gate CI y journey del MVP — RTI-VS1-013

`VS1 CI Gate` verifica backend, arquitectura, integración PostgreSQL, aislamiento
tenant, scripts, frontend, builds y Playwright. El último job recorre el MVP con
Cognito y SES reales sobre una base PostgreSQL desechable; no usa sesiones ni
proveedores simulados.

Ese job requiere el entorno protegido de GitHub `mvp-e2e`, dos cuentas Cognito de
prueba `CONFIRMED`, una identidad SES válida y un rol AWS de mínimo privilegio
obtenido por OIDC. No se guardan access keys, contraseñas ni subjects en Git. La
[guía del 013](docs/architecture/rti-vs1-013-acceptance.md) enumera exactamente las
variables, secretos, permisos, pasos de activación y checks que deben proteger
`master`.

### Desarrollo y comprobaciones

La aplicación web vive en `apps/web` y utiliza Next.js, React, TypeScript, App Router, Tailwind CSS y shadcn/ui. Amplify Auth actúa únicamente como cliente de Cognito.

```text
cd apps/web
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run test:e2e -- --grep-invert @mvp
```

Las rutas `/`, `/login`, `/account`, `/invitations` y `/my-programs` comparten
una fundación visual responsive. El shell autenticado ofrece navegación a las
áreas existentes, pero no sustituye la autorización del backend ni implica que
exista un dashboard completo. El alcance y sus límites están documentados en la
[fundación visual del producto](docs/architecture/product-ui-foundation.md).
`/login` inicia Authorization Code + PKCE y `/account` permite consultar el perfil
interno, seleccionar una organización disponible y cerrar la sesión. Los roles
mostrados proceden del backend. No hay registro público ni dashboard. La ruta
agrupada del frontend es una estructura de UX, no una frontera de seguridad.

## Autenticación de desarrollo

Terraform en `infra/cognito` define exactamente un User Pool de desarrollo compartido, un app client público sin secreto y un dominio administrado. Revisa `infra/cognito/README.md`, copia `terraform.tfvars.example` y utiliza una cuenta y región de desarrollo confirmadas. Los usuarios de prueba se crean manualmente por un administrador; Terraform no crea usuarios, grupos, contraseñas ni Identity Pools.

El flujo implementado es:

1. `/login` redirige a Cognito mediante Authorization Code + PKCE.
2. Cognito vuelve a `/account`; la aplicación nunca recibe una contraseña.
3. El frontend obtiene el Access Token de la sesión y lo envía como Bearer token.
4. Spring Security valida la firma RS256, el emisor, la vigencia, `token_use=access`, `client_id` y `sub`.
5. `GET /api/v1/me` resuelve `sub` a un usuario interno `ACTIVE` y consulta sus membresías y roles en PostgreSQL; no aprovisiona usuarios automáticamente.

Después de aplicar Terraform, copia sus salidas no secretas a las variables Cognito documentadas en `.env.example`. El Access Token —no el ID token— es el artefacto aceptado por la API. No registres tokens, códigos OAuth ni credenciales.

### Contexto de usuario y organizaciones (007)

`GET /api/v1/me` conserva `cognitoSubject` y agrega `user` (`id`, `email`,
`firstName`, `lastName`), `organizations` (`id`, `name`, `roles`),
`activeOrganizationId` y los `roles` de esa organización activa.

- Sin token válido: `401`. Sin usuario interno o con estado distinto de `ACTIVE`: `403`.
- Usuario activo sin organizaciones: `200`, lista vacía, organización activa nula y ningún rol.
- Sólo se ofrecen organizaciones `ACTIVE` con membresía `ACTIVE` del usuario.
- Una organización disponible se selecciona automáticamente; con varias, se elige
  mediante `GET /api/v1/me?organizationId=<uuid>`, validado de nuevo por el backend.
- Organización ajena, inactiva o no disponible: `404`; identificador inválido: `400`.
- No se suman roles entre organizaciones ni se persiste la selección. Cada consulta
  relee los permisos; Cognito Groups y el navegador no son fuentes de autorización.

Un login correcto en Cognito no crea la fila de `rti.users`. Para la aceptación local
se aprovisionó un único usuario expresamente autorizado, después de verificar su
`sub` en Cognito: UUIDv7, estado `ACTIVE`, versión inicial `0` y sin membresías ni
roles. Ese dato local no se distribuye en Git ni en migraciones. En una instalación
vacía `/me` devolverá `403` hasta provisionar una identidad interna válida.
Posteriormente se preparó y aplicó localmente el [bootstrap del primer operador](docs/architecture/first-operator-bootstrap.md):
organización operadora real `Refleja Tu Interior`, membresía `ACTIVE` y rol
`CONSULTANT` limitado a esa organización. El comando administrativo es explícito,
simula por defecto y requiere una identidad interna existente y verificada en
Cognito de desarrollo. No crea usuarios, no concede permisos globales ni implementa
el flujo de creación de organizaciones del 008.

Contrato, pruebas y límites completos: [acta del 007](docs/architecture/rti-vs1-007-acceptance.md).

## Crear una organización (008)

Configura en el `.env` raíz `OPERATOR_ORGANIZATION_ID` con el UUID de la organización
operadora real verificado al terminar el bootstrap. No uses su nombre ni el UUID
de una empresa cliente. Sin ese valor, el backend deniega la creación; un UUID
malformado impide arrancar. Es configuración administrativa del backend, no un
rol global ni un valor confiado al navegador.

Reinicia `dev.cmd`, inicia sesión y pulsa **Comprobar sesión** en `/account`.
Un usuario activo con membresía activa y `CONSULTANT` en la organización operadora
verá **Crear organización**, que abre `/organizations/new`. El formulario solicita
nombre y zona horaria IANA. La API crea en una transacción la organización
`ACTIVE`, la membresía activa del creador y su rol `CONSULTANT`; devuelve
`201`, UUIDv7 y versión inicial `0`. La organización aparece en el resultado
y en `/me` al volver a consultar la cuenta.

`canCreateOrganizations` en `/me` orienta la UI; el POST vuelve a autorizar desde
PostgreSQL. No altera los roles del tenant seleccionado ni concede acceso a
organizaciones ajenas. La política aprobada, matriz de permisos, verificaciones
y pasos de aceptación están en el [acta del 008](docs/architecture/rti-vs1-008-acceptance.md).

## Persistencia local

RTI-VS1-004 utiliza la imagen oficial `postgres:18` mediante Docker Compose. El entorno es exclusivamente de desarrollo y conserva los datos en el volumen nombrado `postgres_data`; ese volumen no forma parte del repositorio.

Para consultar desde un cliente gráfico, usa host `localhost`, el puerto devuelto
por `docker compose port postgres 5432` (en la validación local: `55432`), base
`refleja_tu_interior`, usuario `rti_app` y el valor local de `RTI_APP_PASSWORD`.
Las tablas están en el esquema `rti`. Este usuario tiene permisos de escritura:
consultar datos no requiere editarlos. Cambiar `.env` no cambia la contraseña de
un rol ya inicializado; no elimines el volumen para resolver errores de conexión.

### Prerrequisitos

- Docker Desktop con soporte para contenedores Linux (WSL2 en Windows).
- Java 21.
- Maven.

### Configurar variables locales

Desde la raíz del repositorio, crea el archivo local `.env` a partir del ejemplo:

```powershell
Copy-Item .env.example .env
```

Reemplaza los tres valores de contraseña dentro de `.env`. El archivo `.env` está ignorado por Git y nunca debe confirmarse. Los nombres `rti_migrator` y `rti_app` son roles técnicos; sus contraseñas locales deben ser diferentes.

Si el puerto `5432` ya está ocupado, cambia `POSTGRES_PORT` en `.env` (por ejemplo, a `55432`) y utiliza el mismo puerto en `DB_URL` y `DB_MIGRATION_URL` al iniciar la API.

### Iniciar, inspeccionar y detener PostgreSQL

```powershell
docker compose config
docker compose up -d
docker compose ps
docker compose logs postgres
docker compose down
```

`docker compose down` conserva el volumen. Para reinicializar voluntariamente una base local, usa `docker compose down --volumes`; esta operación elimina los datos locales del volumen.

Durante la primera inicialización, `infra/postgres/init/01-create-rti-database-roles.sh`
crea los roles separados `rti_migrator` y `rti_app`, y crea el schema `rti` bajo
propiedad del migrador. El rol de runtime recibe permisos DML explícitos mediante
Flyway, pero no puede crear objetos en el schema. Para `user_invitations` sólo
recibe lectura, inserción y actualización; no recibe borrado.

### Modelo inicial de persistencia

La migración de RTI-VS1-005 crea exactamente estas tablas de negocio en `rti`:

- `users`
- `organizations`
- `organization_memberships`
- `membership_roles`
- `programs`
- `enrollments`

RTI-VS1-010 agrega `user_invitations` y la referencia opcional desde `enrollments`.
La invitación conserva estado, vencimiento y resultado operativo de entrega; no
almacena contraseñas, códigos OAuth ni tokens de aceptación.

Los incrementos posteriores agregan `program_modules`, `program_sessions`,
`program_activities` y `activity_assignments`. Las definiciones de actividad son
propiedad de `program`; las asignaciones pertenecen a `participation`.

Los identificadores son UUID; Hibernate genera UUIDv7 antes del `INSERT`. Los estados se almacenan por nombre simbólico y se restringen en PostgreSQL. Las referencias entre módulos se representan en JPA como UUID escalares, mientras que las claves foráneas compuestas aseguran que programas, membresías y enrollments pertenezcan a la misma organización. Las entidades y repositorios son detalles internos de persistencia de los módulos `identity`, `organization`, `program` y `participation`.

RTI-VS1-006 y 007 no modifican este esquema ni agregan migraciones. El aprovisionamiento
manual autorizado para la aceptación del 007 es una operación local, no lógica de registro.

### Iniciar la API contra PostgreSQL local

Docker Compose lee `.env` automáticamente, pero Maven no. En la misma sesión de PowerShell, define las credenciales que configuraste en `.env` y las variables Cognito obtenidas de Terraform:

```powershell
$env:DB_URL = "jdbc:postgresql://127.0.0.1:5432/refleja_tu_interior"
$env:DB_USERNAME = "rti_app"
$env:DB_PASSWORD = "<valor de RTI_APP_PASSWORD>"
$env:DB_MIGRATION_URL = $env:DB_URL
$env:DB_MIGRATION_USERNAME = "rti_migrator"
$env:DB_MIGRATION_PASSWORD = "<valor de RTI_MIGRATOR_PASSWORD>"
$env:COGNITO_ISSUER_URI = "<salida issuer_uri>"
$env:COGNITO_JWK_SET_URI = "<salida jwk_set_uri>"
$env:COGNITO_APP_CLIENT_ID = "<salida app_client_id>"

Set-Location apps/api
mvn spring-boot:run
```

Con la API en ejecución, verifica desde otra terminal:

```powershell
Invoke-RestMethod http://localhost:8080/actuator/health
Invoke-WebRequest http://localhost:8080/api/v1/me -SkipHttpErrorCheck
```

El health check es público y `/api/v1/me` responde `401` sin un Access Token válido. El POST de organizaciones también requiere autenticación y su política específica. Las rutas no habilitadas explícitamente se deniegan por defecto. Spring Boot ejecuta Flyway al iniciar. Hibernate usa `ddl-auto=validate` y `spring.jpa.open-in-view` permanece deshabilitado.

### Pruebas de integración

```powershell
Set-Location apps/api
mvn clean verify
```

Las pruebas inician un contenedor efímero `postgres:18` mediante Testcontainers. No usan H2 ni dependen del PostgreSQL iniciado por Docker Compose. Verifican migraciones, roles y persistencia, además de tokens JWT RSA locales válidos e inválidos sin depender de Cognito real.

## Backend API

La API vive en `apps/api`, utiliza Java 21 y Maven. Además de health, identidad,
organizaciones y programas, expone las operaciones del 010 bajo
`/api/v1/organizations/{organizationId}/programs/{programId}/enrollments` y
`/api/v1/invitations`, junto con la consulta propia del 011 bajo
`/api/v1/me/programs`, y las actividades asignadas bajo las rutas documentadas en
[actividades del programa](docs/architecture/program-activities-foundation.md).
La resolución de contexto usa el modelo de lectura JDBC
permitido por ADR-004; las escrituras usan JPA dentro del módulo propietario.
`identity` orquesta el aprovisionamiento externo y la concesión de acceso mediante
APIs públicas de módulo, sin exponer repositorios entre módulos.

## Documentación y decisiones arquitectónicas

La definición de producto y los ADR aceptados se mantienen en el [documento oficial de la Plataforma Refleja Tu Interior](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit).

El índice de ADR-001 a ADR-005, con enlaces directos a cada decisión, está disponible en [`docs/adr/README.md`](docs/adr/README.md).

Todas las implementaciones futuras deberán respetar las decisiones aceptadas. Cualquier cambio arquitectónico significativo deberá documentarse mediante un ADR nuevo o una actualización formal del ADR correspondiente.

## Estado actual

Todavía no existen:

- entregas de actividades, progreso o planes de acción dentro de los programas;
- edición o administración general de organizaciones y programas;
- registro público o administración de usuarios;
- infraestructura de hosting para web, API o PostgreSQL;
- despliegue continuo; el workflow del 013 es exclusivamente un gate de CI.

La integración Cognito/SES del 010 se aplicó y probó en desarrollo con correo real.
Continúan pendientes para un uso externo el remitente corporativo, la autenticación
del dominio, la salida de SES sandbox y la revisión de entregabilidad. El estado
exacto y la distancia al MVP se mantienen en el plan.

Estado y próximos hitos: [plan de implementación](docs/architecture/implementation-plan.md).
