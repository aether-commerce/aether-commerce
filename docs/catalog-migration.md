# Catalog migration runbook

The product form and the `products` table are the only active catalog source. The
legacy migration endpoint is scoped by the Worker's `STORE_ID` and defaults to
an audit-only run.

## Per-store sequence

1. Export the complete D1 database and record the export timestamp. Do not apply
   the cleanup migration until the export and the Cloudflare recovery window
   have been verified.
2. Run `node scripts/migrate-catalog.mjs --api-url <store-api> --token <admin-token>`
   to call `POST /api/v1/admin/products/migrate-legacy` with `{ "dryRun": true }`
   page by page. Stop and correct every reported category, JSON, duplicate, or
   image error before continuing.
3. Re-run the command with `--execute` (which sends `dryRun: false`). The operation keeps product IDs,
   SKUs, slugs, prices, inventory, merchandising flags, and order references.
   It uploads bare or non-Cloudinary images to the store-scoped Cloudinary
   folder and is safe to retry after a timeout.
4. Confirm that the final audit has zero errors, product counts and key fields
   match the pre-migration report, all product images resolve, and no product
   details reference a bare legacy `/products/` asset.
5. Only after every deployed store passes the checks, apply
   `0029_remove_legacy_product_tables.sql` through the normal migration
   pipeline. It removes only the unused singular `product_cache`,
   `product_overrides`, and `category_overrides` tables; the active
   `products_cache` table remains.

The operation is deliberately not run during deploy. Production execution must
be scheduled per store with the appropriate admin credentials, Cloudinary
configuration, D1 export, and post-run storefront/API/administration checks.
