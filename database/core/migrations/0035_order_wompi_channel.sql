-- Keep applied migrations immutable. The application now records the payment
-- provider in orders.channel, so extend the database allowlist with a forward
-- migration while preserving every existing order and its child rows.
DROP INDEX IF EXISTS idx_orders_channel;

ALTER TABLE orders RENAME COLUMN channel TO channel_legacy;
ALTER TABLE orders ADD COLUMN channel TEXT NOT NULL DEFAULT 'stripe'
  CHECK (channel IN ('stripe', 'whatsapp', 'wompi'));
UPDATE orders SET channel = channel_legacy;
ALTER TABLE orders DROP COLUMN channel_legacy;

CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
