# Refleja Tu Interior Platform

Monorepo oficial de la Plataforma Refleja Tu Interior.

El repositorio contiene los bootstraps técnicos iniciales del backend, el frontend y el entorno local de persistencia. RTI-VS1-005 añadió el modelo inicial de persistencia; RTI-VS1-006 añade exclusivamente la autenticación de desarrollo con Amazon Cognito, sin autorización de negocio ni resolución de tenant.

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
│   └── architecture/        # Documentación de arquitectura futura
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

La aplicación web vive en `apps/web` y utiliza Next.js, React, TypeScript, App Router, Tailwind CSS y shadcn/ui. Amplify Auth actúa únicamente como cliente de Cognito.

```text
cd apps/web
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run test:e2e
```

Las rutas `/`, `/login` y `/account` son intencionalmente mínimas. `/login` inicia Authorization Code + PKCE y `/account` permite comprobar la sesión y cerrarla. No existe registro público, dashboard, autorización de negocio ni resolución de tenant. La ruta agrupada del frontend es una estructura de UX, no una frontera de seguridad.

## Autenticación de desarrollo

Terraform en `infra/cognito` define exactamente un User Pool de desarrollo compartido, un app client público sin secreto y un dominio administrado. Revisa `infra/cognito/README.md`, copia `terraform.tfvars.example` y utiliza una cuenta y región de desarrollo confirmadas. Los usuarios de prueba se crean manualmente por un administrador; Terraform no crea usuarios, grupos, contraseñas ni Identity Pools.

El flujo implementado es:

1. `/login` redirige a Cognito mediante Authorization Code + PKCE.
2. Cognito vuelve a `/account`; la aplicación nunca recibe una contraseña.
3. El frontend obtiene el Access Token de la sesión y lo envía como Bearer token.
4. Spring Security valida la firma RS256, el emisor, la vigencia, `token_use=access`, `client_id` y `sub`.
5. `GET /api/v1/me` devuelve únicamente `cognitoSubject`; no aprovisiona usuarios ni consulta membresías.

Después de aplicar Terraform, copia sus salidas no secretas a las variables Cognito documentadas en `.env.example`. El Access Token —no el ID token— es el artefacto aceptado por la API. No registres tokens, códigos OAuth ni credenciales.

## Persistencia local

RTI-VS1-004 utiliza la imagen oficial `postgres:18` mediante Docker Compose. El entorno es exclusivamente de desarrollo y conserva los datos en el volumen nombrado `postgres_data`; ese volumen no forma parte del repositorio.

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

Durante la primera inicialización, `infra/postgres/init/01-create-rti-database-roles.sh` crea los roles separados `rti_migrator` y `rti_app`, y crea el schema `rti` bajo propiedad del migrador. El rol de runtime recibe permisos DML explícitos sobre las seis tablas iniciales mediante Flyway, pero no puede crear objetos en el schema.

### Modelo inicial de persistencia

La migración de RTI-VS1-005 crea exactamente estas tablas de negocio en `rti`:

- `users`
- `organizations`
- `organization_memberships`
- `membership_roles`
- `programs`
- `enrollments`

Los identificadores son UUID; Hibernate genera UUIDv7 antes del `INSERT`. Los estados se almacenan por nombre simbólico y se restringen en PostgreSQL. Las referencias entre módulos se representan en JPA como UUID escalares, mientras que las claves foráneas compuestas aseguran que programas, membresías y enrollments pertenezcan a la misma organización. Las entidades y repositorios son detalles internos de persistencia de los módulos `identity`, `organization`, `program` y `participation`.

RTI-VS1-006 no modifica este esquema, no agrega migraciones y no aprovisiona filas de usuario.

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

El health check es público y `/api/v1/me` responde `401` sin un Access Token válido. Las demás rutas se deniegan por defecto. Spring Boot ejecuta Flyway al iniciar. Hibernate usa `ddl-auto=validate` y `spring.jpa.open-in-view` permanece deshabilitado.

### Pruebas de integración

```powershell
Set-Location apps/api
mvn clean verify
```

Las pruebas inician un contenedor efímero `postgres:18` mediante Testcontainers. No usan H2 ni dependen del PostgreSQL iniciado por Docker Compose. Verifican migraciones, roles y persistencia, además de tokens JWT RSA locales válidos e inválidos sin depender de Cognito real.

## Backend API

La API vive en `apps/api`, utiliza Java 21 y Maven. Sus endpoints operativos actuales son `GET /actuator/health` y `GET /api/v1/me`; este último expone sólo el identificador externo autenticado y no contiene lógica de negocio.

## Documentación y decisiones arquitectónicas

La definición de producto y los ADR aceptados se mantienen en el [documento oficial de la Plataforma Refleja Tu Interior](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit).

El índice de ADR-001 a ADR-005, con enlaces directos a cada decisión, está disponible en [`docs/adr/README.md`](docs/adr/README.md).

Todas las implementaciones futuras deberán respetar las decisiones aceptadas. Cualquier cambio arquitectónico significativo deberá documentarse mediante un ADR nuevo o una actualización formal del ADR correspondiente.

## Estado actual

Todavía no existen:

- lógica de negocio, servicios o casos de uso de producto;
- autorización por roles o membresías y resolución de tenant;
- APIs de organizaciones, programas o participación;
- registro público o administración de usuarios;
- infraestructura AWS distinta del Cognito de desarrollo de RTI-VS1-006;
- pipelines de CI/CD.
