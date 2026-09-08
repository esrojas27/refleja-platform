# Refleja Tu Interior Web

Aplicación Next.js de Refleja Tu Interior. RTI-VS1-006 añade exclusivamente el
bootstrap de autenticación de desarrollo con Amazon Cognito mediante Authorization
Code + PKCE.

Amplify Auth actúa como cliente de Cognito. Las credenciales nunca llegan a la
aplicación y el frontend envía únicamente el Access Token a la API. No hay registro
público, autorización de negocio ni resolución de tenant.

## Configuración

Copia las variables `NEXT_PUBLIC_*` de `.env.example` a `apps/web/.env.local` y
rellénalas con las salidas no secretas de `infra/cognito`. El callback local es
`http://localhost:3000/account` y el retorno posterior al cierre de sesión es
`http://localhost:3000/login`.

## Comandos

```bash
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run test:e2e
```

Playwright inicia automáticamente el servidor de desarrollo en el puerto 3100.
Para ese puerto, el app client de Cognito necesita una URL de callback equivalente
si se ejecuta una autenticación real con el servidor de Playwright.
