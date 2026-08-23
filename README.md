# Refleja Tu Interior Platform

Monorepo oficial de la Plataforma Refleja Tu Interior.

Este repositorio fue inicializado para **RTI-VS1-001 — Bootstrap Monorepo**. En este punto contiene solamente la estructura base: las aplicaciones, la infraestructura y la funcionalidad se incorporarán en tickets posteriores.

## Estructura del repositorio

```text
refleja-platform/
├── apps/
│   ├── web/                 # Reservado para la aplicación web
│   └── api/                 # Reservado para la API
├── infra/                   # Reservado para infraestructura como código
├── docs/
│   ├── adr/                 # Índice de decisiones arquitectónicas
│   └── architecture/        # Documentación de arquitectura futura
├── docker-compose.yml       # Punto de entrada para dependencias locales futuras
├── .gitignore
└── README.md
```

Los directorios reservados contienen únicamente marcadores para que Git conserve la estructura. `docker-compose.yml` no define servicios todavía.

## Documentación y decisiones arquitectónicas

La definición de producto y los ADR aceptados se mantienen en el [documento oficial de la Plataforma Refleja Tu Interior](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit).

El índice de ADR-001 a ADR-005, con enlaces directos a cada decisión, está disponible en [`docs/adr/README.md`](docs/adr/README.md).

Todas las implementaciones futuras deberán respetar las decisiones aceptadas. Cualquier cambio arquitectónico significativo deberá documentarse mediante un ADR nuevo o una actualización formal del ADR correspondiente.

## Estado actual

Todavía no existen:

- aplicaciones frontend o backend inicializadas;
- código de negocio o módulos de dominio;
- dependencias de aplicación;
- migraciones o modelos de persistencia;
- endpoints REST;
- configuración de autenticación, autorización o resolución de tenant;
- infraestructura AWS;
- pipelines de CI/CD.
