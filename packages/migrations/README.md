# @aether-commerce/migrations

Keeps a client repository's D1 migration directory synchronized with the immutable, client-safe Aether schema history.

```sh
pnpm exec aether-migrations sync database/migrations
pnpm exec aether-migrations check database/migrations
```

Existing files are never overwritten. A differing historical migration stops with an error so an already-applied D1 migration cannot be silently changed.

`sync` materializes only missing Aether migrations. `check` makes no writes and
fails if a client is missing a required migration or altered its immutable
history. Client-specific migrations remain in the same directory and are owned
by the client.

The check ignores full-line SQL comments so historical documentation edits do
not prevent a client update. Every executable SQL line remains immutable.

Review and back up the target database before applying pending migrations.
Synchronizing migration files does not execute them: apply them separately
with the D1 migration command configured by the client repository.
