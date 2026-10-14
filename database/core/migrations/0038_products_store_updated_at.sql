CREATE INDEX IF NOT EXISTS idx_products_store_updated_at
  ON products(store_id, updated_at DESC);
