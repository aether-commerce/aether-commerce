-- Category ownership and package templates.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS packages (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS package_categories (id TEXT PRIMARY KEY, package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE, slug TEXT NOT NULL, name TEXT NOT NULL, description TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)), is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(package_id, slug));
CREATE TABLE IF NOT EXISTS stores (id TEXT PRIMARY KEY, package_id TEXT REFERENCES packages(id) ON DELETE SET NULL, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO packages (id, name) VALUES ('package_default', 'Default package');
INSERT OR IGNORE INTO stores (id, package_id, name) VALUES ('store_default', 'package_default', 'Default store');
ALTER TABLE store_categories ADD COLUMN store_id TEXT NOT NULL DEFAULT 'store_default';
ALTER TABLE products ADD COLUMN store_id TEXT NOT NULL DEFAULT 'store_default';
INSERT OR IGNORE INTO package_categories (id, package_id, slug, name, sort_order, is_hidden, is_system) SELECT 'pkgcat_' || id, 'package_default', slug, name, sort_order, is_hidden, is_system FROM store_categories;
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_categories_store_slug ON store_categories(store_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_categories_store_id ON store_categories(store_id, id);
CREATE INDEX IF NOT EXISTS idx_store_categories_store_order ON store_categories(store_id, is_hidden, sort_order, name);
CREATE INDEX IF NOT EXISTS idx_products_store_category ON products(store_id, store_category_id);
CREATE TRIGGER IF NOT EXISTS products_store_category_owner_insert BEFORE INSERT ON products WHEN NEW.store_category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM store_categories c WHERE c.id = NEW.store_category_id AND c.store_id = NEW.store_id) BEGIN SELECT RAISE(ABORT, 'product category belongs to another store'); END;
CREATE TRIGGER IF NOT EXISTS products_store_category_owner_update BEFORE UPDATE OF store_id, store_category_id ON products WHEN NEW.store_category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM store_categories c WHERE c.id = NEW.store_category_id AND c.store_id = NEW.store_id) BEGIN SELECT RAISE(ABORT, 'product category belongs to another store'); END;
