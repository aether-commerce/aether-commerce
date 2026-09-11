-- Product writes now go through the canonical products table and the admin
-- product form. These tables were created by the original catalog adapter,
-- are no longer read or written by the Worker, and contain no relationships
-- from the current commerce schema.
DROP INDEX IF EXISTS idx_product_cache_slug;
DROP TABLE IF EXISTS product_cache;
DROP TABLE IF EXISTS product_overrides;
DROP TABLE IF EXISTS category_overrides;
