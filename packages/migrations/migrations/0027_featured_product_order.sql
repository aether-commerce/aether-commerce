-- Keep this distribution migration aligned with database/core.
ALTER TABLE products ADD COLUMN featured_position INTEGER;
CREATE INDEX IF NOT EXISTS idx_products_store_featured_position
  ON products(store_id, featured, featured_position);
