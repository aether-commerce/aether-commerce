-- Every accepted provider refund has one immutable local row. The order's
-- payment state is derived from the cumulative amount in the same write.
CREATE TRIGGER IF NOT EXISTS refunds_limit_total
BEFORE INSERT ON refunds
WHEN NEW.status = 'succeeded' AND (NEW.amount <= 0 OR NEW.amount + (
  SELECT coalesce(sum(amount), 0) FROM refunds WHERE payment_id = NEW.payment_id AND status = 'succeeded'
) > coalesce((SELECT amount FROM payments WHERE id = NEW.payment_id), 0)
)
BEGIN
  SELECT RAISE(ABORT, 'REFUND_AMOUNT_EXCEEDS_PAYMENT');
END;

CREATE TRIGGER IF NOT EXISTS refunds_limit_total_on_update
BEFORE UPDATE OF status ON refunds
WHEN OLD.status != 'succeeded' AND NEW.status = 'succeeded' AND (NEW.amount <= 0 OR NEW.amount + (
  SELECT coalesce(sum(amount), 0) FROM refunds WHERE payment_id = NEW.payment_id AND status = 'succeeded'
) > coalesce((SELECT amount FROM payments WHERE id = NEW.payment_id), 0))
BEGIN
  SELECT RAISE(ABORT, 'REFUND_AMOUNT_EXCEEDS_PAYMENT');
END;

CREATE TRIGGER IF NOT EXISTS refunds_update_payment_state
AFTER INSERT ON refunds
WHEN NEW.status = 'succeeded'
BEGIN
  UPDATE payments SET status = CASE
    WHEN (SELECT sum(amount) FROM refunds WHERE payment_id = NEW.payment_id AND status = 'succeeded') >= amount THEN 'refunded'
    ELSE 'paid' END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.payment_id;
  UPDATE orders SET payment_status = CASE
    WHEN (SELECT sum(amount) FROM refunds WHERE payment_id = NEW.payment_id AND status = 'succeeded') >= total THEN 'refunded'
    ELSE 'partially_refunded' END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = (SELECT order_id FROM payments WHERE id = NEW.payment_id);
END;

CREATE TRIGGER IF NOT EXISTS refunds_update_payment_state_on_status
AFTER UPDATE OF status ON refunds
WHEN OLD.status != 'succeeded' AND NEW.status = 'succeeded'
BEGIN
  UPDATE payments SET status = CASE
    WHEN (SELECT sum(amount) FROM refunds WHERE payment_id = NEW.payment_id AND status = 'succeeded') >= amount THEN 'refunded'
    ELSE 'paid' END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.payment_id;
  UPDATE orders SET payment_status = CASE
    WHEN (SELECT sum(amount) FROM refunds WHERE payment_id = NEW.payment_id AND status = 'succeeded') >= total THEN 'refunded'
    ELSE 'partially_refunded' END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = (SELECT order_id FROM payments WHERE id = NEW.payment_id);
END;
