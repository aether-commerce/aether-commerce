# Database strategy

`database/core/migrations` is the single D1 migration source and `database/core/schema.ts` is the Drizzle source. Never renumber or rewrite applied migrations. Demo fixtures live in `database/demo/`; client data belongs in client repositories.

Each `application_settings.key` has one owner and one visibility level. Public storefront options and encrypted provider credentials must use distinct keys and typed readers; never return a raw `value_json` from a public route. When splitting an existing key, write only to the new keys and support a read-only legacy fallback until all deployed Workers have been updated. Add regression tests for both legacy data and the public response shape before removing a fallback in a later release.
