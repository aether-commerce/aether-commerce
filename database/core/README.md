# Aether database core

`migrations/` is the only D1 migration source used by the API and assistant
Wrangler configurations. Do not rename or edit an already-applied migration.
`schema.ts` is the Drizzle schema source. Reference-store fixtures and demo
seed data live under `database/demo/` and are never required by production.

## Product timestamps in migrations and SQL maintenance

The public product API validates `products.created_at` and `products.updated_at`
as ISO 8601 UTC timestamps. SQLite's `CURRENT_TIMESTAMP` writes a different
format (`YYYY-MM-DD HH:MM:SS`), which previously caused every catalog request
to fail after a bulk product update. When writing these columns in a migration
or maintenance query, use `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` or pass an
ISO timestamp from the application. Test any bulk product migration against
the public catalog normalization and preserve the original price records when
changing currencies. Migration `0034_product_timestamps_iso.sql` repairs
existing SQL-formatted product timestamps; the API also tolerates them during
gradual deployment.
