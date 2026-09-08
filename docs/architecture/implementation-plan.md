# Plan de implementación — VS1

La secuencia y los criterios de aceptación oficiales están en el
[backlog canónico VS1](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit?tab=t.s1fvvog8kpix).
Este archivo registra el punto de continuación; no reemplaza los tickets ni los
[ADR aceptados](../adr/README.md).

## Estado al 2026-09-07

- **001–005:** implementaciones registradas en Git: monorepo, API, web,
  PostgreSQL/Flyway y modelo inicial de persistencia.
- **006:** implementación de autenticación de desarrollo disponible, pero
  **pendiente de cierre end-to-end**. Las pruebas automatizadas con tokens locales
  y mocks no demuestran un login real contra Cognito.
- **Entorno local:** `dev.cmd` inicia PostgreSQL, API y web. Sus comprobaciones
  prueban disponibilidad, no autenticación real. Configuración y comandos en el
  [README raíz](../../README.md#arranque-local-con-un-comando).
- **007–013:** pendientes; no se implementan como parte de esta publicación.

## Próximo paso: cerrar RTI-VS1-006

1. Iniciar con `dev.cmd` y comenzar un login nuevo desde `/login`, sin reutilizar
   URLs con un código OAuth anterior.
2. Verificar retorno a `/account`, sesión establecida y llamada a la URL efectiva
   de la API con **Access Token**, con respuesta `200` de `/api/v1/me` y el `sub`
   esperado. No guardar tokens ni códigos OAuth como evidencia.
3. Verificar logout y retorno a `/login`.
4. Si persiste el fallo del callback, diagnosticar los eventos OAuth, el estado
   y PKCE y el intercambio de código. El listener OAuth ya está importado;
   no asumir que falta ni debilitar la validación para resolver el problema.

El arranque lento de Next.js queda como mejora operativa separada: se observó una
advertencia de lentitud del sistema de archivos, sin una causa física confirmada.

## Continuación según el backlog aprobado

| Orden | Ticket | Resultado esperado |
| --- | --- | --- |
| 1 | **007 — Internal User and Authorization Context** | Resolver `sub` a usuario interno, membresías y roles de PostgreSQL; contexto autenticado y `/me` con organizaciones disponibles. |
| 2 | **008 — Create Organization End-to-End** | Primera operación de negocio completa: crear una organización desde la web con autorización backend. |
| 3 | **009 — Create Program End-to-End** | Crear un programa dentro de una organización autorizada. |
| 4 | **010 — Enroll and Invite Collaborator** | Incorporar e invitar colaboradores según el ticket. |
| 5 | **011 — Collaborator My Programs** | Permitir al colaborador consultar sus programas. |
| 6 | **012 — Tenant Isolation + RLS Hardening** | Verificar y reforzar el aislamiento entre organizaciones conforme a los ADR. |
| 7 | **013 — End-to-End Test + CI Gate** | Automatizar el journey completo y su puerta de validación en CI. |

### Alcance inmediato del 007

Depende de 005 y 006. Preparar un ticket de implementación acotado a:

- Resolución de identidad interna y contexto con `userId`, `cognitoSubject`,
  organización activa y roles, respetando los límites entre módulos.
- Membresías múltiples y roles múltiples; acceso sólo con membresía `ACTIVE`,
  nunca con `REVOKED`; autorización denegada por defecto.
- `/api/v1/me` con información del usuario y organizaciones disponibles.
- Pruebas de usuario conocido/inexistente, membresía activa/revocada,
  múltiples membresías y múltiples roles.

No adelantar formularios de organizaciones, programas, invitaciones ni dashboard.
No convertir Cognito Groups ni el frontend en fuentes de autorización.
Confirmar contra ADR-003 el comportamiento de usuario inexistente y selección de
organización antes de codificar; cualquier ambigüedad pendiente requiere revisión
humana, no una decisión implícita del agente.

Antes del 008 debe existir el bootstrap controlado del primer operador indicado
en la sección 14 del backlog. Su diseño e implementación no forman parte de esta
publicación ni deben convertirse en una vía de acceso productiva insegura.

## Forma de trabajo

Ejecutar un ticket por vez: revisar el documento canónico y el repositorio,
implementar sólo su alcance, verificar, registrar limitaciones y actualizar el
estado. Publicar código no equivale a declarar completo un ticket sin cumplir sus
criterios de aceptación. No posponer al 012 las garantías de seguridad exigidas
por los ADR para cada funcionalidad anterior.

## Verificación previa a esta publicación

- `mvn.cmd verify` en `apps/api`: 20 pruebas, sin fallos ni omisiones.
- `npm.cmd run lint` y `npm.cmd run build` en `apps/web`: correctos.
- `npm.cmd test -- --maxWorkers=1`: 5 pruebas en 4 archivos, correctas. El intento
  con paralelismo por defecto agotó el tiempo al iniciar workers, sin ejecutar
  pruebas; no se modificaron las aserciones ni la configuración permanente.
- `node --test scripts/dev.test.mjs`: 5 pruebas correctas.
- `terraform fmt -check -diff` y `terraform validate -no-color`: correctos.
- `git diff --cached --check`: correcto; archivos locales y estado Terraform
  excluidos de la publicación. Revisión acotada de valores secretos y patrones de
  credenciales en los archivos candidatos, no una auditoría de seguridad completa.

No se repitieron Playwright ni el login real en esta publicación. Tampoco se
ejecutó un plan/apply de AWS; la validación local de Terraform no demuestra que
los recursos remotos estén sincronizados.
