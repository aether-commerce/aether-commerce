-- Store-owned categories replace the old free-text products.category value.
-- Every generated client has its own D1 database, so these rows are scoped to
-- that client store.  The legacy category column remains temporarily as a
-- denormalized compatibility value for older package versions.
CREATE TABLE IF NOT EXISTS store_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Keeps uncategorized imports and reassignment safe without blocking catalog
-- maintenance. It cannot be removed by the admin API.
INSERT OR IGNORE INTO store_categories (id, slug, name, sort_order, is_system)
VALUES ('cat_uncategorized', 'sin-categoria', 'Sin categoría', -1, 1);

-- Preserve every existing catalog category as a store-owned category. Slugs
-- were already normalized by the product catalog and are therefore safe ids.
INSERT OR IGNORE INTO store_categories (id, slug, name, sort_order)
SELECT 'cat_' || category, category,
       trim(replace(replace(category, '-', ' '), '_', ' ')),
       row_number() OVER (ORDER BY category)
FROM (SELECT DISTINCT category FROM products WHERE trim(category) <> '');

ALTER TABLE products ADD COLUMN store_category_id TEXT REFERENCES store_categories(id);

UPDATE products
SET store_category_id = COALESCE(
  (SELECT id FROM store_categories WHERE slug = products.category),
  'cat_uncategorized'
)
WHERE store_category_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_store_category_id ON products(store_category_id);
CREATE INDEX IF NOT EXISTS idx_store_categories_visible_order ON store_categories(is_hidden, sort_order, name);
