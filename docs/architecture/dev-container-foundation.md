# Fundación de contenedores para DEV

Esta fase prepara el despliegue sin crear recursos en AWS.

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
