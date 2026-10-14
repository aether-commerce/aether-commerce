-- Version catalog snapshots so every Worker isolate can detect a write made
-- by another isolate or a migration. Existing D1 cache payloads use the
-- unversioned products-v2 key and must not survive the transition.
DELETE FROM products_cache WHERE id LIKE 'products-v2:%';

CREATE TRIGGER IF NOT EXISTS catalog_generation_products_insert
AFTER INSERT ON products
BEGIN
  INSERT INTO products_cache (id, source, payload_json, expires_at)
  VALUES ('catalog-generation:' || NEW.store_id, 'catalog-generation', '1', '9999-12-31 23:59:59')
  ON CONFLICT(id) DO UPDATE SET
    source = 'catalog-generation',
    payload_json = CAST(CAST(products_cache.payload_json AS INTEGER) + 1 AS TEXT),
    expires_at = excluded.expires_at,
    updated_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS catalog_generation_products_update
AFTER UPDATE ON products
BEGIN
  INSERT INTO products_cache (id, source, payload_json, expires_at)
  VALUES ('catalog-generation:' || OLD.store_id, 'catalog-generation', '1', '9999-12-31 23:59:59')
  ON CONFLICT(id) DO UPDATE SET
    source = 'catalog-generation',
    payload_json = CAST(CAST(products_cache.payload_json AS INTEGER) + 1 AS TEXT),
    expires_at = excluded.expires_at,
    updated_at = CURRENT_TIMESTAMP;
  INSERT INTO products_cache (id, source, payload_json, expires_at)
  SELECT 'catalog-generation:' || NEW.store_id, 'catalog-generation', '1', '9999-12-31 23:59:59'
  WHERE NEW.store_id <> OLD.store_id
  ON CONFLICT(id) DO UPDATE SET
    source = 'catalog-generation',
    payload_json = CAST(CAST(products_cache.payload_json AS INTEGER) + 1 AS TEXT),
    expires_at = excluded.expires_at,
    updated_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS catalog_generation_products_delete
AFTER DELETE ON products
BEGIN
  INSERT INTO products_cache (id, source, payload_json, expires_at)
  VALUES ('catalog-generation:' || OLD.store_id, 'catalog-generation', '1', '9999-12-31 23:59:59')
  ON CONFLICT(id) DO UPDATE SET
    source = 'catalog-generation',
    payload_json = CAST(CAST(products_cache.payload_json AS INTEGER) + 1 AS TEXT),
    expires_at = excluded.expires_at,
    updated_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS catalog_generation_categories_insert
AFTER INSERT ON store_categories
BEGIN
  INSERT INTO products_cache (id, source, payload_json, expires_at)
  VALUES ('catalog-generation:' || NEW.store_id, 'catalog-generation', '1', '9999-12-31 23:59:59')
  ON CONFLICT(id) DO UPDATE SET
    source = 'catalog-generation',
    payload_json = CAST(CAST(products_cache.payload_json AS INTEGER) + 1 AS TEXT),
    expires_at = excluded.expires_at,
    updated_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS catalog_generation_categories_update
AFTER UPDATE ON store_categories
BEGIN
  INSERT INTO products_cache (id, source, payload_json, expires_at)
  VALUES ('catalog-generation:' || OLD.store_id, 'catalog-generation', '1', '9999-12-31 23:59:59')
  ON CONFLICT(id) DO UPDATE SET
    source = 'catalog-generation',
    payload_json = CAST(CAST(products_cache.payload_json AS INTEGER) + 1 AS TEXT),
    expires_at = excluded.expires_at,
    updated_at = CURRENT_TIMESTAMP;
  INSERT INTO products_cache (id, source, payload_json, expires_at)
  SELECT 'catalog-generation:' || NEW.store_id, 'catalog-generation', '1', '9999-12-31 23:59:59'
  WHERE NEW.store_id <> OLD.store_id
  ON CONFLICT(id) DO UPDATE SET
    source = 'catalog-generation',
    payload_json = CAST(CAST(products_cache.payload_json AS INTEGER) + 1 AS TEXT),
    expires_at = excluded.expires_at,
    updated_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS catalog_generation_categories_delete
AFTER DELETE ON store_categories
BEGIN
  INSERT INTO products_cache (id, source, payload_json, expires_at)
  VALUES ('catalog-generation:' || OLD.store_id, 'catalog-generation', '1', '9999-12-31 23:59:59')
  ON CONFLICT(id) DO UPDATE SET
    source = 'catalog-generation',
    payload_json = CAST(CAST(products_cache.payload_json AS INTEGER) + 1 AS TEXT),
    expires_at = excluded.expires_at,
    updated_at = CURRENT_TIMESTAMP;
END;

-- Initialize every known store, including an empty reference store, after
-- the prior seed/data migrations have completed.
INSERT INTO products_cache (id, source, payload_json, expires_at)
SELECT 'catalog-generation:' || catalog_store_id, 'catalog-generation', '1', '9999-12-31 23:59:59'
FROM (
  SELECT id AS catalog_store_id FROM stores
  UNION SELECT DISTINCT store_id AS catalog_store_id FROM products
  UNION SELECT 'store_default' AS catalog_store_id
) AS catalog_stores
WHERE 1
ON CONFLICT(id) DO UPDATE SET
  source = 'catalog-generation',
  payload_json = CAST(CAST(products_cache.payload_json AS INTEGER) + 1 AS TEXT),
  expires_at = excluded.expires_at,
  updated_at = CURRENT_TIMESTAMP;
