# Refleja Tu Interior Platform

Monorepo oficial de la Plataforma Refleja Tu Interior.

El repositorio contiene los bootstraps técnicos iniciales del backend y del frontend, sin lógica de negocio ni persistencia implementada.

## Estructura del repositorio

```text
refleja-platform/
├── apps/
│   ├── web/                 # Aplicación web Next.js
│   └── api/                 # Aplicación backend Spring Boot
├── infra/                   # Reservado para infraestructura como código
├── docs/
│   ├── adr/                 # Índice de decisiones arquitectónicas
│   └── architecture/        # Documentación de arquitectura futura
├── docker-compose.yml       # Punto de entrada para dependencias locales futuras
├── .gitignore
└── README.md
```

Los directorios que continúan reservados contienen únicamente marcadores para que Git conserve la estructura. `docker-compose.yml` no define servicios todavía.

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

## Backend API

La API vive en `apps/api`, utiliza Java 21 y Maven, y contiene únicamente el arranque técnico requerido por RTI-VS1-002.

```text
cd apps/api
mvn clean verify
mvn spring-boot:run
```

Al ejecutar la aplicación, el único endpoint operativo requerido en ese ticket es `GET /actuator/health`.

## Documentación y decisiones arquitectónicas

La definición de producto y los ADR aceptados se mantienen en el [documento oficial de la Plataforma Refleja Tu Interior](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit).

El índice de ADR-001 a ADR-005, con enlaces directos a cada decisión, está disponible en [`docs/adr/README.md`](docs/adr/README.md).

Todas las implementaciones futuras deberán respetar las decisiones aceptadas. Cualquier cambio arquitectónico significativo deberá documentarse mediante un ADR nuevo o una actualización formal del ADR correspondiente.

## Estado actual

Todavía no existen:

- lógica de negocio, servicios, casos de uso o controladores de dominio;
- entidades, repositorios, migraciones o esquema de base de datos;
- autenticación, autorización o resolución de tenant;
- infraestructura AWS;
- pipelines de CI/CD.
