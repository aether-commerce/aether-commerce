-- The first category migration used a global UNIQUE(slug) constraint. Rebuild
-- the table so two independent stores can legitimately use the same slug.
PRAGMA foreign_keys = OFF;
CREATE TABLE store_categories_scoped (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'store_default',
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, slug)
);
INSERT INTO store_categories_scoped (id, store_id, slug, name, sort_order, is_hidden, is_system, created_at, updated_at)
SELECT id, store_id, slug, name, sort_order, is_hidden, is_system, created_at, updated_at FROM store_categories;
DROP TABLE store_categories;
ALTER TABLE store_categories_scoped RENAME TO store_categories;
CREATE INDEX IF NOT EXISTS idx_store_categories_store_order ON store_categories(store_id, is_hidden, sort_order, name);
CREATE INDEX IF NOT EXISTS idx_store_categories_visible_order ON store_categories(store_id, is_hidden, sort_order, name);
CREATE INDEX IF NOT EXISTS idx_store_categories_store_slug ON store_categories(store_id, slug);
CREATE TRIGGER IF NOT EXISTS products_store_category_owner_insert BEFORE INSERT ON products WHEN NEW.store_category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM store_categories c WHERE c.id = NEW.store_category_id AND c.store_id = NEW.store_id) BEGIN SELECT RAISE(ABORT, 'product category belongs to another store'); END;
CREATE TRIGGER IF NOT EXISTS products_store_category_owner_update BEFORE UPDATE OF store_id, store_category_id ON products WHEN NEW.store_category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM store_categories c WHERE c.id = NEW.store_category_id AND c.store_id = NEW.store_id) BEGIN SELECT RAISE(ABORT, 'product category belongs to another store'); END;
PRAGMA foreign_keys = ON;
