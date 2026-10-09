-- Keep the original amount in each currency so changing the storefront
-- currency never converts an already rounded price a second time.
CREATE TABLE IF NOT EXISTS product_currency_prices (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'COP')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  compare_at_price_cents INTEGER CHECK (compare_at_price_cents >= 0),
  final_price_cents INTEGER NOT NULL CHECK (final_price_cents >= 0),
  PRIMARY KEY (product_id, currency)
);

CREATE TABLE IF NOT EXISTS coupon_currency_amounts (
  code TEXT NOT NULL REFERENCES coupons(code) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'COP')),
  type TEXT NOT NULL CHECK (type IN ('fixed', 'percentage')),
  value INTEGER NOT NULL CHECK (value >= 0),
  minimum_subtotal INTEGER NOT NULL CHECK (minimum_subtotal >= 0),
  PRIMARY KEY (code, currency)
);

CREATE TABLE IF NOT EXISTS shipping_currency_amounts (
  currency TEXT PRIMARY KEY CHECK (currency IN ('USD', 'COP')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0)
);
