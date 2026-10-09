-- SQLite serializes writes. These triggers make the availability check part of
-- the write transaction, so two carts cannot reserve the same last unit.
CREATE TRIGGER IF NOT EXISTS inventory_reservation_capacity_insert
BEFORE INSERT ON inventory_reservations
WHEN NEW.status = 'active' AND datetime(NEW.expires_at) > CURRENT_TIMESTAMP
  AND NEW.quantity + (
    SELECT coalesce(sum(quantity), 0) FROM inventory_reservations
    WHERE product_id = NEW.product_id AND status = 'active' AND datetime(expires_at) > CURRENT_TIMESTAMP
  ) > coalesce((SELECT stock FROM products WHERE id = NEW.product_id), 0)
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_STOCK');
END;

CREATE TRIGGER IF NOT EXISTS inventory_reservation_capacity_update
BEFORE UPDATE OF quantity, status, expires_at ON inventory_reservations
WHEN NEW.status = 'active' AND datetime(NEW.expires_at) > CURRENT_TIMESTAMP
  AND NEW.quantity + (
    SELECT coalesce(sum(quantity), 0) FROM inventory_reservations
    WHERE product_id = NEW.product_id AND status = 'active' AND datetime(expires_at) > CURRENT_TIMESTAMP AND id != OLD.id
  ) > coalesce((SELECT stock FROM products WHERE id = NEW.product_id), 0)
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_STOCK');
END;

CREATE TRIGGER IF NOT EXISTS products_no_negative_stock
BEFORE UPDATE OF stock ON products
WHEN NEW.stock < 0 OR NEW.stock < (
  SELECT coalesce(sum(quantity), 0) FROM inventory_reservations
  WHERE product_id = NEW.id AND status = 'active' AND datetime(expires_at) > CURRENT_TIMESTAMP
)
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_STOCK');
END;
