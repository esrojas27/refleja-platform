# RTI-VS1-006 — Acta de aceptación

**Estado: COMPLETE — validado para desarrollo local con Cognito real.**
Fecha: 2026-09-07 (America/Bogota).

Nota de publicación (2026-09-08): esta acta conserva la evidencia histórica del
cierre del 006. Se publica junto con el 007; su contrato actual de `/me` y el
aprovisionamiento local posterior se describen en el [acta del 007](rti-vs1-007-acceptance.md).
Las referencias siguientes a «esta revisión» corresponden exclusivamente al cierre del 006.

Fuente: [ticket VS1 y ADR aceptados](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit?tab=t.s1fvvog8kpix).
Base publicada: `d99d033`; esta revisión incorpora correcciones y pruebas de cierre
en el working tree. No implica despliegue productivo ni implementación del 007.

## Criterios de aceptación

| Criterio | Resultado y evidencia |
| --- | --- |
| Cognito definido mediante Terraform | Cumple. `infra/cognito` contiene pool, cliente web y dominio; el estado local contiene exactamente esos tres recursos. |
| User Pool de desarrollo existente | Cumple. Consulta AWS al pool `us-east-1_AKiEfWZMK`, nombre `rti-development`. |
| Web App Client existente | Cumple. Cliente `35ihde5ft8qvfuaq7d4ctg92pp`, sin secreto. |
| Next.js inicia login | Cumple. Usuario mostró el formulario real de Cognito; la comprobación aislada del botón confirmó la solicitud OAuth. |
| Next.js cierra sesión | Cumple. Usuario confirmó logout, retorno a `/login` y posterior comprobación sin sesión ni identidad anterior. |
| Spring Security valida Access Tokens | Cumple. Prueba manual real de `/me` con HTTP 200, implementación que envía `accessToken` y pruebas deterministas con firma RSA. |
| Token inválido devuelve 401 | Cumple. HTTP local con token malformado; pruebas de token malformado, firma incorrecta, emisor incorrecto, cliente incorrecto y ausencia de `sub`. |
| Token expirado devuelve 401 | Cumple. Prueba de integración con token firmado y expirado más allá del margen de reloj. |
| `/api/v1/me` requiere autenticación | Cumple. HTTP local sin token devuelve 401; prueba de integración equivalente. |
| Backend lee Cognito `sub` | Cumple. `Jwt.getSubject()` alimenta el DTO; captura manual muestra identidad y 200. Una consulta AWS confirmó que ese identificador corresponde a un usuario del pool, sin guardar datos personales en esta acta. |
| No existe registro público | Cumple. AWS confirma `AllowAdminCreateUserOnly=true`; UI y pruebas sin controles de registro. |

La evidencia manual fue aportada por el usuario en esta tarea, no un login
automatizado por el agente. No se copiaron tokens, contraseñas ni códigos OAuth.

## Configuración real verificada

- Cuenta: `836528258662`; región: `us-east-1`; ambiente: development.
- Perfil: `rti-dev`, rol SSO `AWSReservedSSO_RTI-Development-Administrator_*`, no root.
  La sesión inicial estaba vencida y el usuario la renovó antes de las consultas.
- Dominio: `rti-dev-esroj.auth.us-east-1.amazoncognito.com`, estado `ACTIVE`.
- Grant permitido: únicamente `code`; Implicit no habilitado; scope: `openid`.
- Callback: `http://localhost:3000/account`.
- Logout: `http://localhost:3000/login`.
- Proveedor de identidad del cliente: `COGNITO`; sin MFA, Identity Pool ni grupos
  de negocio incorporados por este ticket.
- Terraform plan: **No changes**, código de salida 0. No se ejecutó `apply`, no se
  crearon recursos y no hubo cambios/destrucciones en AWS durante el cierre.

## Implementación y límites

El frontend usa `aws-amplify@6.20.0`, exclusivamente Auth, con el listener OAuth
cargado antes de `Amplify.configure`. Amplify gestiona la sesión mediante su
comportamiento estándar con `ssr: true`; no se implementó almacenamiento propio ni
se consideran las cookies/claims del navegador una frontera de autorización.
`signInWithRedirect` inicia el flujo y `signOut` cierra la sesión.

Una comprobación con Chromium aislado interceptó la redirección antes de enviarla
a AWS. Confirmó `response_type=code`, `code_challenge_method=S256`, challenge y
state presentes, cliente público y callback correcto. Sólo se imprimieron
booleanos. El primer intento agotó el tiempo antes de observar la solicitud;
la repetición esperando la carga del cliente pasó.

`fetchAuthSession().tokens.accessToken` se envía como Bearer a la API; el ID Token
no se usa para esta llamada. `/api/v1/me` devuelve únicamente
`{ "cognitoSubject": "<sub>" }`, sin consultar ni crear usuarios internos.

Spring Security Resource Server valida RS256, firma, issuer, timestamps,
`token_use=access`, `client_id` y `sub` no vacío. Una prueba de ID Token firmado
confirma rechazo. El health sigue público y las rutas no habilitadas se deniegan
incluso con token válido. La sesión backend permanece stateless.

La revisión detectó detalles del decodificador en el encabezado de error previo.
Ahora los errores 401/403 usan el contrato ADR-005 con `code`, `message` genérico y
`requestId`; `X-Request-ID` permite correlacionar el error. El desafío Bearer no
incluye detalles internos. Esto no cambia la validación ni el contrato 200 de `/me`.

No se modificaron migraciones, tablas, entidades, repositorios ni dependencias.
Las seis tablas de VS1 siguen sin columnas de contraseñas, hashes o tokens.
No se incorporaron roles desde Cognito Groups, tenant resolution, autorización
de negocio, sincronización de perfiles, invitaciones ni UI de administración.
No hay logging explícito de credenciales/tokens en el código de autenticación
revisado. Los logs del launcher aplican su redacción existente; no se afirma una
auditoría exhaustiva de extensiones del navegador o de todo el equipo.

Las dependencias directas originales del 006 fueron Amplify Auth y los starters
Spring Boot OAuth2 Resource Server y WebMVC Test (estos últimos administrados por
el BOM/parent aprobado). Este cierre no agrega paquetes ni cambia versiones.

## Verificación ejecutada

| Comando / comprobación | Resultado |
| --- | --- |
| `mvn.cmd clean verify` en `apps/api`; repetición final `mvn.cmd -f apps/api/pom.xml clean verify` desde raíz | 23 pruebas; 0 fallos, errores u omisiones. Incluye 11 de autenticación, persistencia PostgreSQL 18/Testcontainers y boundaries Modulith. |
| `npm.cmd run lint` en `apps/web` | Correcto. |
| `npm.cmd test -- --maxWorkers=1` | 7 pruebas, 4 archivos; sin omitir aserciones ni cambiar paralelismo permanente. |
| `npm.cmd run build` | Correcto; TypeScript y prerender de `/`, `/login` y `/account`. |
| `$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; npm.cmd run test:e2e -- --workers=1` | 3 smoke tests correctos contra la app local existente. No representan un login automático con credenciales reales. |
| `npm.cmd ls --depth=0` | Dependencias instaladas disponibles. No se repitió `npm ci`: lockfile sin cambios y app en uso; instalación reproducible ejecutada previamente por el launcher. |
| `terraform fmt -check -diff`; `terraform validate -no-color` | Correctos; se reutilizó la inicialización existente, sin actualizar providers. |
| `terraform plan -input=false -no-color -detailed-exitcode -var=aws_region=us-east-1 -var=cognito_domain_prefix=rti-dev-esroj -var=resource_prefix=rti` con `AWS_PROFILE=rti-dev` | Sin diferencias, código 0. |
| `aws sts get-caller-identity --profile rti-dev` y consultas `describe-user-pool`, `describe-user-pool-client`, `describe-user-pool-domain` | Cuenta/rol y configuración esperados. Se filtraron campos para no devolver secretos. |
| Consulta `list-users` filtrada por el `sub` de la prueba manual | Una coincidencia; sólo se mostró la cantidad. |
| HTTP local mediante `fetch` | Health 200/UP; `/me` sin token 401; token malformado 401. |
| Revisión Git, migraciones y código de autenticación | Sin estado Terraform/credenciales versionados, sin expansión de persistencia ni lógica del 007. |

## Archivos de este cierre

- `.gitignore`: agrega `*.tfvars` y `*.tfvars.json`; las plantillas `.example`
  siguen disponibles. Corrige una protección que estaba documentada pero ausente.
- `apps/api/src/main/java/com/reflejatuinterior/ActuatorHealthSecurityConfiguration.java`:
  errores de seguridad genéricos conforme a ADR-005.
- `apps/api/src/test/java/com/reflejatuinterior/identity/infrastructure/security/CognitoAuthenticationIntegrationTests.java`:
  firma, emisor, deny-by-default y contrato de error.
- `apps/web/src/__tests__/account-session.test.tsx`: identidad visible y limpieza
  de la identidad anterior cuando deja de estar disponible la sesión.
- `apps/web/playwright.config.ts`: opción explícita `PLAYWRIGHT_BASE_URL` restringida
  a origen HTTP(S) local; permite probar sin iniciar un segundo servidor Next.js.
- `docs/architecture/implementation-plan.md`: estado actualizado del 006.
- Este archivo: evidencia y alcance del cierre.

## Limitaciones y siguiente paso

- La validación es local con Cognito real, no en staging/producción.
- El anterior fallo del callback no se reprodujo en el recorrido manual; no se
  identificó su causa raíz ni se declara corregida por estos cambios.
- Logout limpia la sesión del navegador; no se promete revocación inmediata de
  un JWT ya emitido y copiado fuera del navegador.
- No se detuvieron los procesos del usuario. Reiniciar `dev.cmd` carga el nuevo
  contrato de errores; el cambio se verificó en el backend recompilado mediante
  las pruebas de integración, no en la instancia antigua aún en ejecución.
- No quedan bloqueos arquitectónicos para este ticket. Antes de considerar una
  regresión futura, repetir el recorrido manual sin reutilizar códigos OAuth.
- No se hizo commit/push ni se comenzó RTI-VS1-007 en esta revisión.

Siguiente ticket disponible: RTI-VS1-007, sólo mediante su encargo acotado.
