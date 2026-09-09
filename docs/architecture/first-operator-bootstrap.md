# Primer operador de desarrollo

## Alcance y decisión aprobada

Implementado y aplicado localmente el 2026-09-08, antes de RTI-VS1-008. Responde al
bootstrap administrativo de la sección 14 del [backlog canónico](https://docs.google.com/document/d/1vzpG5ZiD6uTD6jT9USe_R1rdhU7bN54Q38Ty3Udu-Ik/edit?tab=t.s1fvvog8kpix),
respetando los [ADR aceptados](../adr/README.md).

Con aprobación expresa se usa la organización operadora real **Refleja Tu
Interior**, slug `refleja-tu-interior`, estado `ACTIVE` y zona `America/Bogota`.
El usuario interno existente recibe una membresía `ACTIVE` con **CONSULTANT**.
No es una organización ficticia ni un rol global; no existe `SUPER_ADMIN`.

Este procedimiento no implementa el 008: no crea formulario ni endpoint de
organizaciones, no provisiona usuarios y no crea programas o inscripciones.
La autorización de la futura operación de creación debe implementarse y probarse
en ese ticket, sin interpretar este rol como acceso a todos los tenants.

## Requisitos y ejecución

- Node.js y Docker Desktop local con contenedores Linux.
- PostgreSQL del proyecto iniciado, roles y migraciones existentes aplicados.
- `.env` raíz con configuración Cognito del proyecto.
- AWS CLI con sesión de rol asumido activa en un perfil de desarrollo y permisos
  de lectura para STS, User Pool, app client y usuarios Cognito.
- Usuario Cognito habilitado, confirmado, con email verificado; una fila interna
  `ACTIVE` con el mismo `sub`, email y email normalizado. No se crea ni sincroniza
  automáticamente esa fila.

Desde la raíz, sustituye los valores entre `<...>`; no son valores literales:

```powershell
aws sso login --profile rti-dev
.\bootstrap-operator.cmd --subject <Cognito-sub> --profile rti-dev --account <cuenta-AWS-de-12-digitos>
```

Por defecto ejecuta las comprobaciones e inserciones dentro de una transacción
que termina en **ROLLBACK**. `mode: dry-run` y `result: created` indican qué habría
creado, no datos persistidos. Para aplicar después de revisar el destino:

```powershell
.\bootstrap-operator.cmd --subject <Cognito-sub> --profile rti-dev --account <cuenta-AWS-de-12-digitos> --apply --confirm-development
```

Alternativa portable: `node scripts/bootstrap-operator.mjs` con los mismos
argumentos. `--help` muestra la sintaxis. El comando devuelve código distinto de
cero si falla una comprobación. No se ejecuta automáticamente desde `dev.cmd`,
Spring Boot, Flyway, Terraform ni el login.

## Garantías y límites operativos

- Fija un socket Docker local verificado; rechaza destinos TCP/SSH. Comprueba
  proyecto Compose, directorio, servicio, imagen `postgres:18`, base y volumen.
- Contrasta cuenta AWS explícita, rol asumido, pool y app client de `.env`.
  Exige las etiquetas `Application=refleja-tu-interior` y
  `Environment=development`, cliente público y callback local. AWS sólo se consulta.
- Resuelve la identidad por `sub`, no por una búsqueda de email. No añade grupos,
  contraseñas, credenciales ni permisos AWS.
- Ejecuta DML como `rti_app`, sin superusuario ni `BYPASSRLS`. La conexión usa el
  socket local dentro del contenedor autorizado; no valida la contraseña de
  DBeaver. No modifica el schema ni agrega migraciones o dependencias.
- Una transacción con bloqueo de las cuatro tablas implicadas evita bootstrap
  concurrente y cambios parciales. Los tiempos de espera son acotados; ejecútalo
  como operación administrativa puntual, no durante pruebas de carga.
- La creación inicial exige ausencia de otras organizaciones. Una organización
  compatible ya aprovisionada devuelve `unchanged`, conservando IDs y versiones.
  No incorpora otro operador, reactiva estados ni restituye un rol eliminado.
  Ambigüedades y discrepancias abortan; requieren revisión humana, no borrado del
  volumen ni reparación automática.
- Genera UUIDv7 y versión inicial `0` para organización y membresía. Los estados y
  roles usan nombres simbólicos y las restricciones PostgreSQL existentes.
- Imprime un resultado JSON con actor AWS, identificador de ejecución, fecha,
  modo, resultado e IDs internos. No imprime email, tokens, contraseñas ni salida
  cruda de errores. Es evidencia operativa en stdout, **no** auditoría centralizada
  persistente; conserva la salida en un lugar de acceso restringido si la necesitas.

El script requiere acceso administrativo local a Docker y no es una frontera de
seguridad frente a quien ya administra la máquina/base. No es un mecanismo de
aprovisionamiento productivo ni de administración general de usuarios.

## Verificación

```powershell
node --check scripts/bootstrap-operator.mjs
node --check scripts/bootstrap-operator.integration.test.mjs
node --test scripts/bootstrap-operator.test.mjs scripts/dev.test.mjs
node --test scripts/bootstrap-operator.integration.test.mjs
git diff --check
git status --short
```

Las pruebas de integración usan un contenedor PostgreSQL 18 independiente, sin
puertos publicados y con red deshabilitada. Aplican las migraciones existentes a
una base efímera; no borran ni alteran la base de desarrollo. El contenedor de
prueba se elimina al terminar.

Cobertura: simulación sin persistencia, creación exacta, repetición, concurrencia,
rollback ante fallo intermedio, identidad inexistente/inactiva/discrepante,
organización ambigua o incompatible, membresía revocada y rol eliminado. Las
pruebas unitarias cubren validación de argumentos y destinos Docker/Cognito/AWS.

Resultado: **8 pruebas unitarias del bootstrap**, **5 del arranque existente** y
**13 de integración PostgreSQL**, todas correctas.

También se repitió la suite backend con límites temporales de recursos:

```powershell
Set-Location apps/api
$env:MAVEN_OPTS = ($env:MAVEN_OPTS + ' -Xmx256m -XX:ActiveProcessorCount=2').Trim()
mvn.cmd '-DargLine=-Xmx512m -XX:ActiveProcessorCount=2' verify
```

Resultado: **38 pruebas backend correctas**, sin fallos, errores ni omisiones.
No se cambiaron configuraciones permanentes ni se debilitaron comprobaciones.
No se repitió frontend/build/Playwright: no se modificó código web.

## Evidencia local y aceptación visual

El dry-run dejó cero organizaciones y membresías. La aplicación autorizada creó
exactamente una organización y una membresía, ambas `ACTIVE`, con `CONSULTANT`.
La segunda aplicación devolvió `unchanged` con los mismos IDs. La lectura posterior
confirmó UUIDv7, zona horaria y ausencia de programas e inscripciones. Los datos
personales e identificadores de esta instalación no se distribuyen en Git.

En `/account`, pulsa **Comprobar sesión** con el usuario autorizado: debe aparecer
`Refleja Tu Interior` como única organización, seleccionada automáticamente, y
`CONSULTANT`. No requiere reiniciar el backend: `/me` vuelve a leer los permisos.
El usuario confirmó esta comprobación con una captura de `/account`: la interfaz
y la respuesta de `/me` muestran `Refleja Tu Interior` como organización activa y
`CONSULTANT` como rol de esa organización. La preparación del primer operador
queda validada para desarrollo local.

Este incremento se conserva en un commit independiente, previo a RTI-VS1-008.
