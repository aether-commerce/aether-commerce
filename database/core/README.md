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


## Catalog cache generations

The API stores a monotonic `catalog-generation:<store_id>` value in
`products_cache`. Migration `0037_catalog_cache_generation.sql` installs
triggers for product and category inserts, updates, and deletes; these advance
the generation in the same database transaction as the visible change. Do not
edit product or category data manually in the Cloudflare console. Use the
admin interface for operational edits, and include a new forward migration
when data must change during deployment. Any future migration that changes
catalog data must preserve these triggers or explicitly advance the same
generation in its transaction. Test that a warm API cache and a request from a
different Worker isolate both observe the new data.

## Payment providers and order channels

`orders.channel` is constrained by a database check as well as the application
payment-provider contract. When adding a provider, add its channel in a new
forward migration and test that existing Stripe and WhatsApp orders and their
payment rows survive the migration. Never edit the already-applied
`0015_order_channel_status.sql` migration.
