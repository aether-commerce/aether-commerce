-- Give store operators explicit control over the four products shown in the
-- storefront hero. NULL keeps existing featured products on the rating-based
-- fallback until an operator assigns a position.
ALTER TABLE products ADD COLUMN featured_position INTEGER;
CREATE INDEX IF NOT EXISTS idx_products_store_featured_position
  ON products(store_id, featured, featured_position);
