# Fundación de contenedores para DEV

Esta fase prepara el despliegue sin crear recursos en AWS.

## Compilación de CI en ARM64 nativo

El gate de contenedores y el despliegue de DEV usan `ubuntu-24.04-arm` y
construyen imágenes `linux/arm64`, la arquitectura de la instancia Graviton.
Ambos comprueban `uname -m = aarch64` antes de construir y no registran QEMU.
Las cachés `dev-api-arm64-native-v1` y `dev-web-arm64-native-v1` se comparten
entre ambos workflows y no reutilizan las capas del antiguo build emulado.

Este ajuste corrige el fallo del 2026-10-25: la compilación y TypeScript de
Next.js terminaban correctamente, pero un worker de generación de páginas
abortaba bajo QEMU con `Illegal instruction` / `SIGILL`. La advertencia de
`metadataBase` no era el error fatal. No se cambian las imágenes base, los
límites de memoria, los permisos OIDC, los datos ni los recursos de AWS.

`node --test scripts/check-native-arm64-workflows.test.mjs` comprueba las
invariantes de configuración en CI. La validación definitiva es completar
la construcción nativa y el despliegue con comprobación pública de salud.
Los comandos ARM64 en máquinas x64 de la sección local todavía requieren
emulación; no sustituyen esa validación nativa de GitHub.

## Validación local

1. Copiar `config/dev.env.example` a `config/dev.env` y reemplazar los valores.
2. Validar estructura, puertos y memoria:

   ```powershell
   node scripts/check-dev-container-budget.mjs
   ```

3. Construir imágenes para la arquitectura de destino:

   ```powershell
   docker buildx build --platform linux/arm64 -f apps/api/Dockerfile apps/api
   docker buildx build --platform linux/arm64 -f apps/web/Dockerfile apps/web `
     --build-arg NEXT_PUBLIC_AWS_REGION=$env:NEXT_PUBLIC_AWS_REGION `
     --build-arg NEXT_PUBLIC_COGNITO_USER_POOL_ID=$env:NEXT_PUBLIC_COGNITO_USER_POOL_ID `
     --build-arg NEXT_PUBLIC_COGNITO_APP_CLIENT_ID=$env:NEXT_PUBLIC_COGNITO_APP_CLIENT_ID `
     --build-arg NEXT_PUBLIC_COGNITO_DOMAIN=$env:NEXT_PUBLIC_COGNITO_DOMAIN `
     --build-arg NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN=$env:NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN `
     --build-arg NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT=$env:NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT `
     --build-arg NEXT_PUBLIC_API_BASE_URL=$env:NEXT_PUBLIC_API_BASE_URL
   ```

4. Para una prueba ejecutable en la máquina actual:

   ```powershell
   docker compose --env-file config/dev.env -f compose.dev.yml build
   docker compose --env-file config/dev.env -f compose.dev.yml up -d
   docker compose --env-file config/dev.env -f compose.dev.yml ps
   ```

   Abrir `http://localhost:8088`. API, web y PostgreSQL no deben publicar puertos
   directamente. Al terminar, ejecutar `docker compose --env-file
   config/dev.env -f compose.dev.yml down`; no agregar `--volumes` si se quieren
   conservar los datos de prueba.

## Configuración en EC2

Usar `DEV_SITE_ADDRESS=dev.dominio.com`, `DEV_PUBLIC_URL=https://dev.dominio.com`,
`DEV_HTTP_PORT=80` y `DEV_HTTPS_PORT=443`. Los valores `NEXT_PUBLIC_*` forman parte
del artefacto de Next.js y por eso deben estar presentes al construir la imagen;
un cambio exige una nueva imagen web.

Los límites declarados suman 1408 MiB. La prueba definitiva en `t4g.small` debe
registrar consumo en reposo y durante login, listado de programas y una operación
de escritura. Si ocurre OOM o el sistema usa swap sostenidamente, se detiene el
despliegue y se mide antes de aumentar la instancia o relajar el presupuesto.
