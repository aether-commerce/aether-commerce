# Ambiente de desarrollo de Aether Commerce

`main` representa producción. Usa `develop` para validar cambios completos de tienda antes de promoverlos.

## Flujo recomendado

1. Crea una rama de feature desde `develop`.
2. Abre PR contra `develop`.
3. CI ejecuta typecheck, lint, tests, OpenAPI, build y pruebas del asistente.
4. Al mergear en `develop`, GitHub Actions despliega el ambiente de desarrollo en Cloudflare.
5. Revisa storefront, admin, API y asistente.
6. Abre PR de `develop` a `main` para producción.

## Servicios esperados

- Storefront desarrollo: `https://aether-storefront.pickofwow.workers.dev`
- API desarrollo: `https://aether-api.pickofwow.workers.dev`
- Asistente desarrollo: `https://aether-ai.pickofwow.workers.dev`
- Admin desarrollo: `https://develop.aether-admin.pages.dev` (branch `develop`)

Producción nueva:

- Storefront: `https://store.diferez.com`
- API: `https://aether-api-production.pickofwow.workers.dev`
- Asistente: `https://aether-ai-production.pickofwow.workers.dev`
- Admin: `https://admin.diferez.com`

## GitHub Environment `development`

Variables:

- `CLOUDFLARE_DEPLOY_ENABLED=true`
- `AETHER_API_WORKER_NAME=aether-api`
- `AETHER_AI_WORKER_NAME=aether-ai`
- `AETHER_FRONT_WORKER_NAME=aether-storefront`
- `AETHER_ADMIN_PAGES_PROJECT=aether-admin`
- `AETHER_D1_DATABASE_NAME=aether-production` (reclasificada como D1 de develop).
- `AETHER_D1_DATABASE_ID=a7f8dd17-1120-40f7-9457-374d53991702`
- `APP_ORIGIN_STORE=https://aether-storefront.pickofwow.workers.dev`
- `APP_ORIGIN_ADMIN=https://develop.aether-admin.pages.dev`
- `NEXT_PUBLIC_AETHER_API_URL=https://aether-api.pickofwow.workers.dev`
- `NEXT_PUBLIC_AETHER_AI_URL=https://aether-ai.pickofwow.workers.dev`
- `NEXT_PUBLIC_PORTFOLIO_URL=https://portafolio-aether-commerce.pickofwow.workers.dev`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: publishable key de Clerk test/dev.

Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `AETHER_CART_TOKEN_SECRET`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER`
- `GEMINI_API_KEY`
- `AI_OPERATIONS_TOKEN`

Opcionales según funciones habilitadas:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `WOMPI_SECRET_KEY`
- `WOMPI_EVENTS_SECRET`
- `AETHER_SETTINGS_ENCRYPTION_KEY` (only needed to manage checkout secrets from the admin panel; see `docs/security.md`)
- `RESEND_API_KEY`
- `CONTACT_RECIPIENT_EMAIL`

Usa llaves de test/dev. No reutilices secretos productivos en este environment.

## Base D1 de desarrollo

El D1 existente `aether-production` se conserva como la base de develop para
mantener sus datos actuales. La producción nueva usa una base independiente
`aether-production-live`; su `database_id` debe guardarse únicamente en el
environment `production` de GitHub.

## Validación local

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm build
```

Para probar D1 local:

```bash
pnpm db:migrate:local
pnpm db:seed
```
