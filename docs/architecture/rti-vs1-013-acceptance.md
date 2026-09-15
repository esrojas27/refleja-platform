# RTI-VS1-013 — End-to-End Test + CI Gate

Estado: **implementado y validado remotamente**. El gate completo está verde;
quedan pendientes la protección de `master`, el PR de comprobación y la etiqueta
`V0.1.0` para completar el cierre administrativo del MVP.

Se revisaron Product Definition, ADR-001 a ADR-005 y el ticket 013 del
[documento canónico](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit?tab=t.s1fvvog8kpix).

## Journey automático

`apps/web/e2e/mvp-journey.spec.ts` ejecuta con Chromium y servicios locales:

1. login del consultor mediante Cognito Authorization Code + PKCE;
2. creación de una organización y selección de su contexto;
3. creación de un programa `DRAFT`;
4. registro e invitación de un colaborador Cognito existente;
5. logout del consultor;
6. login del colaborador, consulta y aceptación explícita de la invitación;
7. comprobación de rol `COLLABORATOR`, listado de **Mis programas** y detalle del
   programa asignado.

No hay proveedor de identidad simulado, sesión inyectada ni bypass del backend.
Las trazas, videos y capturas están deshabilitados en este test porque pueden
contener credenciales, tokens o artefactos OAuth. Los nombres de organización y
programa incluyen el identificador del run para evitar colisiones.

## Gate de GitHub Actions

`.github/workflows/ci.yml` se ejecuta en pull requests, pushes a `master` y bajo
ejecución manual. Expone tres checks:

- **Backend gate:** Java 21, compilación Maven, pruebas unitarias, arquitectura,
  integración con PostgreSQL real y aislamiento tenant.
- **Frontend gate:** Node 22.22.2, scripts del repositorio, ESLint, Vitest/RTL,
  build Next.js y smoke tests Playwright sin sesión.
- **MVP E2E gate:** espera los dos gates anteriores; levanta PostgreSQL 18 en un
  volumen desechable, aplica Flyway, siembra sólo el operador técnico, inicia API
  y web y ejecuta el journey real.

El job E2E usa el entorno protegido de GitHub `mvp-e2e`. La base se exige vacía y
se elimina con su volumen aunque el test falle. La semilla es soporte de prueba,
no una migración ni una ruta de la aplicación.

## Configuración protegida

Variables del entorno `mvp-e2e`:

- `RTI_E2E_AWS_ACCOUNT_ID`
- `RTI_E2E_AWS_ROLE_ARN`
- `RTI_E2E_AWS_REGION`
- `RTI_E2E_COGNITO_USER_POOL_ID`
- `RTI_E2E_COGNITO_APP_CLIENT_ID`
- `RTI_E2E_COGNITO_DOMAIN`

Valores públicos verificados el 2026-09-13:

| Variable | Valor |
| --- | --- |
| `RTI_E2E_AWS_ACCOUNT_ID` | `836528258662` |
| `RTI_E2E_AWS_ROLE_ARN` | `arn:aws:iam::836528258662:role/refleja-tu-interior-github-actions` |
| `RTI_E2E_AWS_REGION` | `us-east-1` |
| `RTI_E2E_COGNITO_USER_POOL_ID` | `us-east-1_AKiEfWZMK` |
| `RTI_E2E_COGNITO_APP_CLIENT_ID` | `35ihde5ft8qvfuaq7d4ctg92pp` |
| `RTI_E2E_COGNITO_DOMAIN` | `rti-dev-esroj.auth.us-east-1.amazoncognito.com` |

Secretos del entorno:

- `RTI_E2E_CONSULTANT_SUBJECT`
- `RTI_E2E_CONSULTANT_EMAIL`
- `RTI_E2E_CONSULTANT_PASSWORD`
- `RTI_E2E_COLLABORATOR_EMAIL`
- `RTI_E2E_COLLABORATOR_PASSWORD`
- `RTI_E2E_SES_FROM`

Las dos cuentas deben existir, estar habilitadas y `CONFIRMED` en el User Pool; sus
contraseñas deben ser permanentes y diferentes. El consultor y el colaborador no
pueden ser la misma cuenta. Mientras SES permanezca en sandbox, remitente y
destinatario deben estar verificados. Cada run solicita un correo real.

El rol debe llamarse `refleja-tu-interior-github-actions`, obtenerse mediante el
proveedor OIDC de GitHub y limitar su confianza a:

```text
repo:esrojas27@62344298/refleja-platform@1344197039:environment:mvp-e2e
```

El repositorio usa el formato de sujeto inmutable de GitHub; la política IAM no
debe utilizar el formato heredado basado únicamente en nombres. La audiencia se
limita a `sts.amazonaws.com`.

Permisos mínimos de la sesión: `cognito-idp:AdminGetUser` sobre el User Pool de
desarrollo y `ses:SendEmail` desde la identidad SES aprobada. No se requieren
access keys persistentes, administración general de Cognito ni permisos sobre una
base externa.

`node scripts/check-mvp-e2e-environment.mjs` falla antes de iniciar AWS si falta
configuración o si cuenta, rol, región, pool y dominio no son coherentes. Nunca
imprime contraseñas ni valores de identidad.

## Ejecución y cierre

Evidencia remota de aceptación:

- [`VS1 CI Gate` — run 34783940404](https://github.com/esrojas27/refleja-platform/actions/runs/34783940404),
  commit `e5caaf0`, ejecutado el 2026-09-13.
- `Backend gate`, `Frontend gate` y `MVP E2E gate`: correctos.
- El paso `Verify the two pre-existing Cognito test accounts` confirmó estado
  `CONFIRMED` para consultor y colaborador y la coincidencia del `sub` del
  consultor. Los dos logins reales del journey comprobaron que ambas cuentas
  estaban habilitadas para autenticarse.
- El journey real completó creación de organización y programa, invitación,
  cambio de sesión, aceptación y consulta del programa por el colaborador.

Las comprobaciones sin secretos pueden reproducirse localmente:

```powershell
Set-Location apps/api
mvn verify

Set-Location ../web
npm ci
npm run lint
npm test -- --maxWorkers=1
npm run build
npm run test:e2e -- --workers=1 --grep-invert @mvp

Set-Location ../..
node --test scripts/dev.test.mjs
node --test scripts/bootstrap-operator.test.mjs
node --test scripts/check-mvp-e2e-environment.test.mjs
```

`bootstrap-operator.integration.test.mjs` requiere Docker y se mantiene como una
comprobación explícita para equipos con ese runtime disponible; no forma parte
del gate frontend. El journey E2E ya verifica la inicialización contra su propio
PostgreSQL desechable.

El journey autenticado se ejecuta desde Actions para garantizar una base nueva,
credenciales protegidas y AWS temporal. El entorno, el rol OIDC y el run verde ya
están verificados. Para completar el cierre:

1. configurar en las reglas de `master` como checks requeridos `Backend gate`,
   `Frontend gate` y `MVP E2E gate`;
2. abrir un PR de comprobación y confirmar que el merge permanece bloqueado hasta
   que finalicen correctamente los tres checks;
3. publicar la etiqueta `V0.1.0` sobre el commit de cierre aprobado.

No se implementó funcionalidad posterior al Vertical Slice 1.
