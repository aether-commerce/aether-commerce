-- Storefront merchandising deliberately references store-owned catalog categories.
-- It carries only content and stable visual references, never CSS, JSX, or theme markup.
CREATE TABLE IF NOT EXISTS storefront_category_sections (
  store_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  eyebrow TEXT,
  title TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS storefront_category_configs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES store_categories(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  position INTEGER NOT NULL DEFAULT 0,
  display_name TEXT,
  description TEXT,
  visual_type TEXT NOT NULL DEFAULT 'icon' CHECK (visual_type IN ('icon', 'image', 'none')),
  icon_key TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_storefront_category_configs_store_position
  ON storefront_category_configs(store_id, enabled, position);

CREATE TRIGGER IF NOT EXISTS storefront_category_config_owner_insert
BEFORE INSERT ON storefront_category_configs
WHEN NOT EXISTS (SELECT 1 FROM store_categories c WHERE c.id = NEW.category_id AND c.store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'storefront category belongs to another store'); END;

CREATE TRIGGER IF NOT EXISTS storefront_category_config_owner_update
BEFORE UPDATE OF store_id, category_id ON storefront_category_configs
WHEN NOT EXISTS (SELECT 1 FROM store_categories c WHERE c.id = NEW.category_id AND c.store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'storefront category belongs to another store'); END;

-- A category can be removed after its products are reassigned. Clean up its
-- merchandising entry in the same database operation to avoid dangling config.
CREATE TRIGGER IF NOT EXISTS storefront_category_config_cleanup
AFTER DELETE ON store_categories
BEGIN DELETE FROM storefront_category_configs WHERE category_id = OLD.id AND store_id = OLD.store_id; END;

-- Preserve the current Aether reference storefront exactly, but migrate the
-- data out of its React component into store-scoped configuration.
INSERT OR IGNORE INTO storefront_category_sections (store_id, enabled, eyebrow, title, description)
VALUES ('store_default', 1, 'CATEGORÍAS', 'Comprar por categoría', 'Diez categorías curadas de un catálogo multi-departamento en vivo.');

INSERT OR IGNORE INTO storefront_category_configs (id, store_id, category_id, enabled, position, display_name, description, visual_type, icon_key)
SELECT 'scfg_store_default_' || c.slug, 'store_default', c.id, 1,
  CASE c.slug
    WHEN 'smartphones' THEN 0 WHEN 'laptops' THEN 1 WHEN 'mobile-accessories' THEN 2 WHEN 'tablets' THEN 3
    WHEN 'mens-watches' THEN 4 WHEN 'womens-watches' THEN 5 WHEN 'sunglasses' THEN 6 WHEN 'furniture' THEN 7
    WHEN 'home-decoration' THEN 8 WHEN 'sports-accessories' THEN 9 END,
  CASE c.slug
    WHEN 'smartphones' THEN 'Smartphones' WHEN 'laptops' THEN 'Laptops' WHEN 'mobile-accessories' THEN 'Accesorios Móvil'
    WHEN 'tablets' THEN 'Tablets' WHEN 'mens-watches' THEN 'Relojes Hombre' WHEN 'womens-watches' THEN 'Relojes Mujer'
    WHEN 'sunglasses' THEN 'Gafas de Sol' WHEN 'furniture' THEN 'Muebles' WHEN 'home-decoration' THEN 'Decoración'
    WHEN 'sports-accessories' THEN 'Accesorios Deportivos' END,
  CASE c.slug
    WHEN 'smartphones' THEN 'Teléfonos insignia y de uso diario.' WHEN 'laptops' THEN 'Ultrabooks y estaciones de trabajo.'
    WHEN 'mobile-accessories' THEN 'Fundas, cargadores y complementos.' WHEN 'tablets' THEN 'Pantallas portátiles para trabajo y ocio.'
    WHEN 'mens-watches' THEN 'Relojes para toda ocasión.' WHEN 'womens-watches' THEN 'Relojes elegantes formales y diarios.'
    WHEN 'sunglasses' THEN 'Protección UV con acabado premium.' WHEN 'furniture' THEN 'Piezas para hogar, escritorio y estudio.'
    WHEN 'home-decoration' THEN 'Detalles que completan un espacio.' WHEN 'sports-accessories' THEN 'Equipo para entrenar con constancia.' END,
  'icon', CASE c.slug
    WHEN 'smartphones' THEN 'smartphone' WHEN 'laptops' THEN 'laptop' WHEN 'mobile-accessories' THEN 'headphones'
    WHEN 'tablets' THEN 'tablet' WHEN 'mens-watches' THEN 'watch' WHEN 'womens-watches' THEN 'watch'
    WHEN 'sunglasses' THEN 'glasses' WHEN 'furniture' THEN 'sofa' WHEN 'home-decoration' THEN 'lamp'
    WHEN 'sports-accessories' THEN 'sports' END
FROM store_categories c
WHERE c.store_id = 'store_default' AND c.slug IN ('smartphones', 'laptops', 'mobile-accessories', 'tablets', 'mens-watches', 'womens-watches', 'sunglasses', 'furniture', 'home-decoration', 'sports-accessories');
