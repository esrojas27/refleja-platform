# RTI-VS1-011 — Collaborator My Programs

Estado: **cerrado para desarrollo local**. La verificación automática y el
recorrido manual con la cuenta colaboradora real fueron correctos.
RTI-VS1-012 se documenta por separado en `rti-vs1-012-acceptance.md`.

Se revisaron Product Definition, ADR-001 a ADR-005 y el ticket 011 del
[documento canónico](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit?tab=t.s1fvvog8kpix).

## Alcance implementado

| Operación | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/v1/me/programs?page=0&size=20` | Programas de las inscripciones `ACTIVE` o `COMPLETED` de la identidad autenticada |
| GET | `/api/v1/me/programs/{programId}` | Información básica de un programa asignado a esa identidad |

La API obtiene el participante desde el `sub` del Access Token validado. No acepta
`participantId`, `userId` ni `organizationId` como fuente de autorización. Para
cada solicitud exige usuario, organización y membresía `ACTIVE`, además del rol
interno `COLLABORATOR`. Un programa de otra persona, otra organización o una
inscripción no disponible se oculta con 404. La ausencia de autenticación responde
401 y la falta de acceso colaborador activo responde 403.

El listado usa paginación `page`/`size`, con tamaño predeterminado 20 y máximo 100.
Expone únicamente identificadores del programa y organización, nombre de la
organización, nombre, descripción, estado, fechas y versión del programa. No
expone información de otros participantes.

## Interfaz mínima

- `/account` muestra **Mis programas** cuando la organización disponible contiene
  el rol `COLLABORATOR`.
- `/my-programs` lista nombre, organización, fechas y estado de cada programa
  asignado, con estados vacíos, error y paginación.
- `/my-programs/{programId}` abre el detalle básico del programa seleccionado.
- Ambas vistas son responsive y obtienen el Access Token mediante Amplify; no
  confían en IDs o roles elegidos por el navegador.

No se implementaron sesiones, actividades, progreso, talentos, planes de acción,
dashboards ni operaciones de administración del programa.

## Límites modulares y persistencia

`identity` publica una API de módulo para resolver las membresías colaboradoras
activas de la identidad. `participation`, propietario de las inscripciones,
orquesta la consulta y usa la API pública de lectura de `program`; no comparte
repositorios ni entidades JPA entre módulos.

La implementación reutiliza las tablas y restricciones existentes. No agrega
migraciones ni dependencias. La consulta filtra por los identificadores de las
membresías resueltas en backend y por estados de inscripción válidos; después
revalida que programa, inscripción, membresía y organización coincidan.

## Verificación automática

- Backend: `mvn.cmd -DargLine="-Xmx512m -XX:ActiveProcessorCount=2" verify`:
  **163 pruebas**, 0 fallos y 0 omisiones. Diez pruebas nuevas de integración usan
  JWT RSA, Spring Security y PostgreSQL 18 real mediante Testcontainers.
- Frontend: `npm.cmd test -- --maxWorkers=1`: **85 pruebas** en 11 archivos,
  todas correctas; incluye cliente HTTP, render de listado/detalle y enlace desde
  Cuenta.
- `npm.cmd run lint`: correcto, sin advertencias.
- `npm.cmd run build`: correcto; Next.js generó `/my-programs` y
  `/my-programs/[programId]` con TypeScript válido.
- `npm.cmd run test:e2e -- --workers=1`: **10 pruebas** Playwright correctas,
  incluido el smoke responsive sin sesión de ambas rutas nuevas.

Los escenarios backend prueban respuesta 200 para programas propios, listado
limitado a inscripciones `ACTIVE`/`COMPLETED`, ocultamiento de programas de otra
persona, aislamiento entre organizaciones, estados de usuario/membresía/organización,
denegación sin token y que roles incluidos en el JWT no sustituyen los roles de
PostgreSQL.

## Validación manual completada

Con `dev.cmd` en ejecución, el usuario confirmó:

1. Inicio de sesión correcto con la cuenta colaboradora usada en el 010.
2. Organización activa, rol `COLLABORATOR` y acceso a **Mis programas** desde
   `/account`.
3. Listado exclusivo del programa respaldado por su inscripción aceptada.
4. Apertura correcta del detalle básico con organización, estado y fechas.
5. Funcionamiento general del recorrido sin exponer programas de otras personas.

No deben copiarse tokens, contraseñas ni códigos OAuth como evidencia. Una captura
del listado y otra del detalle, sin DevTools mostrando el Bearer token, son
suficientes.

## Criterio de cierre y limitaciones

Los criterios funcionales y de seguridad están cubiertos automáticamente y el
recorrido real fue aceptado por el usuario. El ticket queda cerrado para desarrollo
local.

No existe despliegue compartido de web, API o PostgreSQL; la prueba sigue siendo
local con Cognito de desarrollo. RLS quedó implementado en el 012 y el gate E2E/CI
pertenece al 013. Los controles de identidad, persona y tenant del 011 ya están
activos en el backend y no dependen del ticket futuro.
