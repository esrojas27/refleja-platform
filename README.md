# Refleja Tu Interior Platform

Monorepo oficial de la Plataforma Refleja Tu Interior.

El repositorio contiene los bootstraps técnicos iniciales del backend, el frontend y el entorno local de persistencia, sin lógica de negocio.

## Estructura del repositorio

```text
refleja-platform/
├── apps/
│   ├── web/                 # Aplicación web Next.js
│   └── api/                 # Aplicación backend Spring Boot
├── infra/
│   └── postgres/init/       # Bootstrap técnico de roles y schema locales
├── docs/
│   ├── adr/                 # Índice de decisiones arquitectónicas
│   └── architecture/        # Documentación de arquitectura futura
├── docker-compose.yml       # PostgreSQL local para desarrollo
├── .env.example             # Variables locales de ejemplo, sin secretos reales
├── .gitignore
└── README.md
```

## Frontend web

La aplicación web vive en `apps/web` y utiliza Next.js, React, TypeScript, App Router, Tailwind CSS y shadcn/ui.

```text
cd apps/web
npm install
npm run dev
npm run lint
npm test
npm run build
npm run test:e2e
```

RTI-VS1-003 incluye únicamente las rutas `/` y `/login`, más una estructura de layout para contenido autenticado futuro. No implementa autenticación ni dashboard.

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

Durante la primera inicialización, `infra/postgres/init/01-create-rti-database-roles.sh` crea los roles separados `rti_migrator` y `rti_app`, y crea el schema `rti` bajo propiedad del migrador. El rol de runtime recibe únicamente acceso al schema; las migraciones futuras deberán conceder de forma explícita los permisos requeridos sobre cada objeto.

### Iniciar la API contra PostgreSQL local

Docker Compose lee `.env` automáticamente, pero Maven no. En la misma sesión de PowerShell, define las credenciales que configuraste en `.env`:

```powershell
$env:DB_URL = "jdbc:postgresql://127.0.0.1:5432/refleja_tu_interior"
$env:DB_USERNAME = "rti_app"
$env:DB_PASSWORD = "<valor de RTI_APP_PASSWORD>"
$env:DB_MIGRATION_URL = $env:DB_URL
$env:DB_MIGRATION_USERNAME = "rti_migrator"
$env:DB_MIGRATION_PASSWORD = "<valor de RTI_MIGRATOR_PASSWORD>"

Set-Location apps/api
mvn spring-boot:run
```

Con la API en ejecución, verifica el health check desde otra terminal:

```powershell
Invoke-RestMethod http://localhost:8080/actuator/health
```

Spring Boot ejecuta Flyway al iniciar. Flyway administra `rti` y almacena su historial en `rti.flyway_schema_history`. Hibernate está configurado con `ddl-auto=validate`: valida los mappings, pero no crea, actualiza ni elimina objetos de base de datos. `spring.jpa.open-in-view` permanece deshabilitado.

### Pruebas de integración

```powershell
Set-Location apps/api
mvn clean verify
```

La prueba de integración inicia su propio contenedor efímero `postgres:18` mediante Testcontainers. No usa H2 ni depende del PostgreSQL iniciado por Docker Compose. La prueba comprueba la conexión de Spring Boot, la versión mayor 18, la existencia de `rti`, la migración registrada por Flyway, el modo `ddl-auto=validate` y que no se hayan creado tablas de negocio.

## Backend API

La API vive en `apps/api`, utiliza Java 21 y Maven, y conserva únicamente el arranque técnico requerido por los tickets de bootstrap.

El único endpoint operativo actual es `GET /actuator/health`. No existen todavía APIs de negocio.

## Documentación y decisiones arquitectónicas

La definición de producto y los ADR aceptados se mantienen en el [documento oficial de la Plataforma Refleja Tu Interior](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit).

El índice de ADR-001 a ADR-005, con enlaces directos a cada decisión, está disponible en [`docs/adr/README.md`](docs/adr/README.md).

Todas las implementaciones futuras deberán respetar las decisiones aceptadas. Cualquier cambio arquitectónico significativo deberá documentarse mediante un ADR nuevo o una actualización formal del ADR correspondiente.

## Estado actual

Todavía no existen:

- lógica de negocio, servicios, casos de uso o controladores de dominio;
- entidades, repositorios o tablas de dominio;
- autenticación, autorización o resolución de tenant;
- infraestructura AWS;
- pipelines de CI/CD.
