# Plan de implementación — VS1

La secuencia y los criterios de aceptación oficiales están en el
[backlog canónico VS1](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit?tab=t.s1fvvog8kpix).
Este archivo registra el punto de continuación; no reemplaza los tickets ni los
[ADR aceptados](../adr/README.md).

## Estado al 2026-09-08

- **001–005:** implementaciones registradas en Git: monorepo, API, web,
  PostgreSQL/Flyway y modelo inicial de persistencia.
- **006:** completo para desarrollo local con Cognito real. Login, `/me` con 200,
  logout y ausencia posterior de sesión confirmados por el usuario; configuración
  AWS y pruebas contrastadas en el [acta de aceptación](rti-vs1-006-acceptance.md).
- **007:** completo para su alcance local. Usuario interno, membresías y roles
  resueltos en PostgreSQL; recorrido positivo y negativo confirmado por el usuario,
  con pruebas multiorganización automáticas. [Acta del 007](rti-vs1-007-acceptance.md).
- **Entorno local:** `dev.cmd` inicia PostgreSQL, API y web. Sus comprobaciones
  prueban disponibilidad, no autenticación real. Configuración y comandos en el
  [README raíz](../../README.md#arranque-local-con-un-comando).
- **008–013:** pendientes; no se implementan como parte de esta publicación.

## Antes de comenzar el 008

Revisar y preparar el mecanismo controlado del primer operador de la sección 14
del backlog. Para aceptar el 007 se creó, con autorización expresa y `sub`
verificado en Cognito, un usuario interno local `ACTIVE` sin membresías ni roles.
Ese registro permite consultar su perfil, pero **no autoriza crear organizaciones**
y no es un bootstrap reproducible del primer operador.

El mecanismo pendiente debe habilitar al operador de desarrollo de forma explícita
y limitada, sin registro público, sin usar Cognito Groups como fuente de roles y
sin introducir una puerta de acceso productiva. El backlog no exige otro ADR para
este punto; cualquier decisión no cubierta por los ADR debe revisarse antes de
implementarla. No se ha implementado dicho mecanismo ni iniciado el 008.

El arranque lento de Next.js queda como mejora operativa separada: se observó una
advertencia de lentitud del sistema de archivos, sin una causa física confirmada.

## Continuación según el backlog aprobado

| Orden | Ticket | Resultado esperado |
| --- | --- | --- |
| 1 | **008 — Create Organization End-to-End** | Formulario funcional, creación autorizada y organización visible en UI. Requiere el primer operador. |
| 2 | **009 — Create Program End-to-End** | Crear, listar y consultar programas de una organización autorizada; estado inicial DRAFT. |
| 3 | **010 — Enroll and Invite Collaborator** | Inscribir e invitar al colaborador; membresía, rol y enrollment según el ticket. |
| 4 | **011 — Collaborator My Programs** | El colaborador inicia sesión y ve exclusivamente sus programas asignados. |
| 5 | **012 — Tenant Isolation + RLS Hardening** | RLS en tablas aplicables y pruebas PostgreSQL de aislamiento entre organizaciones. |
| 6 | **013 — End-to-End Test + CI Gate** | Automatizar el journey completo y su puerta de validación en CI. |

## Distancia al MVP validable

La referencia concreta aprobada es **VS1 / V0.1.0**, no el producto completo.
La base técnica 001–007 está lista, pero todavía no existe el recorrido empresarial.
Siete tickets cerrados no equivalen a un porcentaje de avance del producto.

- **Después del 008:** primera operación visible de negocio, crear una organización.
- **Después del 009:** demostración del flujo organización → programa.
- **Después del 011:** recorrido funcional inicial completo para consultor y colaborador.
- **Después del 012 y 013:** cierre oficial de VS1, con aislamiento reforzado y
  recorrido demostrado manual y automáticamente. No se pospone la seguridad básica
  de los tickets 008–011 hasta el 012.

El recorrido objetivo es: consultor inicia sesión → crea organización → crea
programa → inscribe/invita colaborador → colaborador inicia sesión → ve su programa.
La validación temprana puede hacerse localmente con Cognito de desarrollo; un
ambiente compartido para pruebas externas requiere preparación y verificación
separadas. No se han desplegado web/API/BD en la nube ni aprobado nuevos recursos
como parte de este cierre.

Sesiones, actividades, progreso, dashboards avanzados, reportes, IA y pagos siguen
fuera de VS1. El incremento busca validar un flujo real pequeño, no el diseño final.

## Forma de trabajo

Ejecutar un ticket por vez: revisar el documento canónico y el repositorio,
implementar sólo su alcance, verificar, registrar limitaciones y actualizar el
estado. Publicar código no equivale a declarar completo un ticket sin cumplir sus
criterios de aceptación. No posponer al 012 las garantías de seguridad exigidas
por los ADR para cada funcionalidad anterior.

## Evidencia de cierre actual

El [acta del 007](rti-vs1-007-acceptance.md) registra 38 pruebas backend,
17 frontend, lint/build y 3 smoke tests de navegador sobre el build de producción,
además de la aceptación manual con Cognito real. Los fallos de arranque de las
primeras ejecuciones están documentados, sin desactivar comprobaciones.
La última repetición backend previa a publicar falló por memoria nativa de la JVM,
incluso con heap limitado; las 38 pruebas corresponden a la ejecución aprobada
anterior. Repetir con memoria disponible antes del próximo incremento.

## Evidencia histórica de la publicación inicial del 006 (`d99d033`)

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
