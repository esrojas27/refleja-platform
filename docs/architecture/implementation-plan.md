# Plan de implementación — VS1

La secuencia y los criterios de aceptación oficiales están en el
[backlog canónico VS1](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit?tab=t.s1fvvog8kpix).
Este archivo registra el punto de continuación; no reemplaza los tickets ni los
[ADR aceptados](../adr/README.md).

## Estado al 2026-09-13

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
- **008:** cerrado para desarrollo local. Pruebas automáticas correctas y usuario
  confirma creación de organización, aparición en su cuenta y selección con
  CONSULTANT. [Acta y procedimiento](rti-vs1-008-acceptance.md).
- **009:** cerrado para desarrollo local. Creación, listado paginado y detalle de
  programas verificados automáticamente; el usuario confirmó el recorrido manual.
  [Contrato y procedimiento](rti-vs1-009-acceptance.md). El 008 quedó separado en
  el commit `b45e0aa`, sin push, con worktree limpio antes de iniciar el 009.
- **010:** cerrado y publicado en `bbf8d98`. Se validaron con Cognito/SES reales el
  alta, los dos correos, login inicial, aceptación y activación del colaborador. La
  prueba real permitió corregir el contrato `AdminCreateUser RESEND` para pools con
  email como username.
- **011:** cerrado para desarrollo local. El colaborador puede listar
  y abrir sólo programas respaldados por inscripciones propias `ACTIVE` o
  `COMPLETED`; el usuario confirmó el recorrido con Cognito real.
  [Acta y procedimiento](rti-vs1-011-acceptance.md).
- **012:** cerrado y publicado en `6a2ba68`. RLS protege programas e inscripciones,
  el runtime no puede evadirlo y el recorrido manual fue confirmado.
  [Acta del 012](rti-vs1-012-acceptance.md).
- **013:** journey E2E y workflow CI implementados y validados. El
  [run `34783940404`](https://github.com/esrojas27/refleja-platform/actions/runs/34783940404)
  completó correctamente backend, frontend y el recorrido MVP con Cognito/SES
  reales. El rol usa el sujeto OIDC inmutable del repositorio. Pendientes:
  proteger `master`, comprobar el bloqueo mediante PR y publicar `V0.1.0`.
- **Fundación de producto posterior a VS1:** la identidad visual y la navegación
  ya cubren el espacio de trabajo del programa. También están implementados
  dimensiones configurables, sesiones con objetivo y el ciclo de actividades:
  asignación masiva o individual, enlace opcional de YouTube, respuesta textual,
  solicitud de cambios y aprobación. La API v1 conserva `/modules` como contrato
  legado. El progreso agregado por programa, dimensión, sesión y colaborador está
  implementado localmente a partir de las asignaciones existentes. Evaluaciones y
  archivos continúan pendientes.
- **Primer operador:** mecanismo administrativo implementado y aplicado localmente
  con aprobación expresa: organización operadora real, membresía activa y rol
  `CONSULTANT` acotado. [Procedimiento y evidencia](first-operator-bootstrap.md).

## Primer operador y política del 008

El mecanismo controlado del primer operador de la sección 14 del backlog ya está
preparado. Utiliza el usuario interno `ACTIVE` previamente verificado y agrega
exclusivamente la organización operadora `Refleja Tu Interior`, su membresía activa
y `CONSULTANT`. No hay registro público, roles en Cognito Groups ni endpoint de
bootstrap. Una repetición no duplica datos ni restaura permisos revocados.

El usuario confirmó visualmente el contexto actualizado en `/account`: organización
operadora activa y rol `CONSULTANT`, coincidentes con `/me`. Después aprobó limitar
la creación de organizaciones a consultores activos de esa organización operadora
y asignar al creador una membresía activa con `CONSULTANT` en la nueva organización.
El 008 aplica esa política usando el UUID configurado en el backend, sin confiar
en nombres o permisos enviados por el navegador. No habilita acceso a otros tenants.

El arranque lento de Next.js queda como mejora operativa separada: se observó una
advertencia de lentitud del sistema de archivos, sin una causa física confirmada.

## Continuación según el backlog aprobado

| Orden | Ticket | Resultado esperado |
| --- | --- | --- |
| 1 | **Cierre de VS1** | Exigir los tres checks en `master`, validarlos mediante un PR de prueba y publicar `V0.1.0`. |

## Descubrimiento posterior al MVP

La reunión de producto del 2026-09-14 agregó necesidades de perfil inicial,
roles Líder/RRHH, ficha DISC, plantillas de programa, cambio de módulos a
dimensiones, objetivo de sesión, video de YouTube, avisos de vencimiento,
evaluaciones inicial/final, identidad visual, idioma y progreso. Las decisiones,
dependencias y una secuencia propuesta están registradas en el
[backlog de descubrimiento posterior al MVP](product-discovery-backlog.md).

La alineación inicial de terminología y contenido ya fue implementada de forma
compatible; los demás elementos aún no son tickets aprobados. En especial, no se deben inferir los
campos que entregará Tata, las preguntas que entregará Paula Rojas ni el alcance de
autorización de Líder y RRHH.

## Distancia al MVP validable

La referencia concreta aprobada es **VS1 / V0.1.0**, no el producto completo.
La base técnica 001–007 está lista. La primera operación empresarial, crear una
organización (008), está implementada y aceptada manualmente. El recorrido
de programas (009) está implementado y aceptado manualmente;
el registro, entrega y aceptación de invitaciones está implementado y validado
contra Cognito/SES reales.
Diez tickets cerrados no equivalen a un porcentaje de avance del producto.

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

Para el 013: el [run `34783940404`](https://github.com/esrojas27/refleja-platform/actions/runs/34783940404)
quedó verde con `Backend gate`, `Frontend gate` y `MVP E2E gate`. El job protegido
validó sus valores públicos, obtuvo credenciales AWS temporales por OIDC, comprobó
las dos cuentas Cognito `CONFIRMED` y ejecutó el recorrido completo sobre una base
PostgreSQL desechable. [Acta del 013](rti-vs1-013-acceptance.md).

Para el 011: 163 pruebas backend, 85 frontend y 10 smoke tests Playwright
correctos; lint y build de producción correctos. Las pruebas incluyen programas
propios, otra persona, otra organización, estados no disponibles, paginación y
autorización basada en PostgreSQL. El usuario confirmó con Cognito real el listado
exclusivo y la apertura del programa asignado. [Acta del 011](rti-vs1-011-acceptance.md).

Para el 010: 153 pruebas backend, 76 frontend, 6 del lanzador y 9 smoke tests
Playwright correctos; lint, build de producción y `terraform validate` correctos.
Se verificaron remitente y destinatario SES, se aplicó la configuración AWS sin
reemplazar Cognito y se confirmó el journey completo con un colaborador distinto:
correos recibidos, login inicial, aceptación, estados `ACTIVE` y `/me` con rol
`COLLABORATOR`. El cierre está publicado en `bbf8d98`.

El [acta del 009](rti-vs1-009-acceptance.md) registra 113 pruebas backend,
47 frontend, 13 de scripts y 7 smoke tests Playwright correctos, además de lint,
build y arranque. El usuario confirmó la validación manual del flujo de programas.
El cierre del 009 se conserva en un commit independiente; el usuario autorizó
su publicación junto con los commits locales previos antes de comenzar el 010.

El [acta del 007](rti-vs1-007-acceptance.md) registra 38 pruebas backend,
17 frontend, lint/build y 3 smoke tests de navegador sobre el build de producción,
además de la aceptación manual con Cognito real. Los fallos de arranque de las
primeras ejecuciones están documentados, sin desactivar comprobaciones.
La repetición backend previa a publicar falló por memoria nativa de la JVM.
Después, durante el bootstrap del primer operador, `mvn.cmd verify` volvió a
completar las **38 pruebas sin fallos ni omisiones**, con límites temporales de
heap y procesadores para esa ejecución; no se modificó la configuración del
proyecto. Las pruebas y comandos del bootstrap están en su
[guía operativa](first-operator-bootstrap.md).

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
