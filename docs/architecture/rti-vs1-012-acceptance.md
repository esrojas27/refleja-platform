# RTI-VS1-012 — Tenant Isolation + RLS Hardening

Estado: **cerrado para desarrollo local**. La verificación automática y el
recorrido manual autenticado fueron correctos. RTI-VS1-013 no ha comenzado.

Se revisaron Product Definition, ADR-001 a ADR-005 y el ticket 012 del
[documento canónico](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit?tab=t.s1fvvog8kpix).

## Alcance de RLS

La migración `V20260912010000__tenant_isolation_rls.sql` habilita PostgreSQL Row
Level Security en `rti.programs` y `rti.enrollments`. Ambas políticas comparan
`organization_id` con `app.current_organization_id` y aplican la misma condición
a lectura y escritura. Sin contexto tenant, el rol runtime no ve filas y no puede
crear filas tenant-scoped.

El alcance sigue la clasificación vigente:

- `users` es global.
- `organizations`, `organization_memberships` y `membership_roles` forman el
  plano de descubrimiento y autorización que permite resolver primero el tenant.
- `user_invitations` mantiene el acceso previo a membresía activa necesario para
  que una persona descubra y acepte sus propias invitaciones.
- `programs` y `enrollments` son los recursos operativos tenant-scoped protegidos
  por RLS en este incremento.

Las tablas que no reciben RLS en esta migración conservan autorización explícita,
consultas acotadas por identidad/organización y restricciones referenciales. Su
clasificación no concede acceso adicional ni reemplaza los controles de aplicación.

## Contexto tenant y autorización

`OrganizationTenantContext` establece el tenant mediante
`set_config('app.current_organization_id', ..., true)`. Rechaza llamadas sin una
transacción activa, por lo que el valor queda ligado a la transacción y a su
conexión; al finalizar no queda disponible para la siguiente operación.

Programas e inscripciones activan el contexto únicamente después de resolver en
backend el usuario, su membresía, la organización activa y el rol autorizado. Las
consultas continúan incluyendo `organization_id`: RLS es defensa en profundidad,
no la única barrera. Los accesos directos a recursos ajenos siguen ocultándose con
404 cuando corresponde.

El recorrido **Mis programas** soporta usuarios colaboradores con membresías en
más de una organización. Cada bloque de consultas cambia de forma explícita al
tenant autorizado correspondiente y mantiene una paginación determinística por
organización e identificador. Ningún identificador o rol enviado por el navegador
establece el contexto de PostgreSQL.

## Roles de base de datos

El rol `rti_app` conserva únicamente permisos DML y está configurado con
`NOSUPERUSER` y `NOBYPASSRLS`. `rti_migrator` es propietario de las tablas y se usa
exclusivamente para migraciones. La aplicación continúa conectándose con
`rti_app`; no se añadió una vía runtime que evada las políticas.

Se evaluó `FORCE ROW LEVEL SECURITY` y no se habilitó para estas tablas
operativas: el rol runtime no es propietario y ya queda sujeto a RLS, mientras
que el propietario separado necesita conservar la capacidad de migración. Las
tablas sensibles futuras deberán volver a evaluar `FORCE` desde su creación,
como exige ADR-004.

## Verificación

Las pruebas con PostgreSQL 18 real mediante Testcontainers comprueban:

- existencia y activación de las políticas RLS;
- propiedades `rolsuper=false` y `rolbypassrls=false` del rol runtime;
- cero filas visibles sin contexto tenant;
- visibilidad exclusiva de programas e inscripciones del tenant activo;
- reinicio del contexto después de finalizar la transacción;
- bloqueo de inserciones, actualizaciones y eliminaciones cross-tenant aun
  conociendo los UUID;
- respuestas 404 de la API para recursos de otra organización;
- funcionamiento de invitaciones y de **Mis programas** en una o varias
  organizaciones.

Resultados ejecutados el 2026-09-12:

- `mvn -DargLine="-Xmx512m -XX:ActiveProcessorCount=2" verify`: **170
  pruebas**, 0 fallos, 0 errores y 0 omisiones; build del JAR correcto.
- `npm.cmd run lint`: correcto, sin errores.
- `npm.cmd test -- --maxWorkers=1`: **85 pruebas** en 11 archivos, todas
  correctas.
- `npm.cmd run build`: correcto; Next.js 16.3.2 compiló TypeScript y todas las
  rutas existentes.
- `dev.cmd --smoke`: correcto; aplicó la migración 012 a PostgreSQL local,
  inició API y web, obtuvo health `UP`, `/me` respondió 401 sin token y `/`,
  `/login` y `/account` respondieron 200; API y web se detuvieron al finalizar.
- Consulta local con `rti_app` sin contexto tenant: `programs=0` y
  `enrollments=0`; `rti_app` y `rti_migrator` reportaron `rolsuper=false` y
  `rolbypassrls=false`, y ambas políticas quedaron registradas.

## Validación manual completada

El usuario confirmó el recorrido autenticado con los dos perfiles del MVP:

- el consultor pudo seleccionar su organización y consultar el programa y sus
  inscripciones;
- el colaborador pudo acceder a su organización con rol `COLLABORATOR` y abrir
  su listado y detalle de **Mis programas**;
- los recursos visibles correspondieron a la organización y a la relación de
  participación esperadas.

No se conservaron tokens, contraseñas ni códigos OAuth como evidencia.

No se agregaron dependencias: Spring JDBC, Flyway, PostgreSQL y Testcontainers ya
eran parte del stack aprobado. No se implementó funcionalidad del 013.
