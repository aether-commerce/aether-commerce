import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function migratedDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const path = join(process.cwd(), "database", "core", "migrations");
  for (const file of readdirSync(path).filter((name) => name.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(path, file), "utf8"));
  }
  return db;
}

test("migrated SQLite admits one of twenty carts for the last unit and rejects negative stock", () => {
  const db = migratedDatabase();
  const product = db.prepare("select id, sku from products limit 1").get();
  db.prepare("update products set stock = 1 where id = ?").run(product.id);
  const insert = db.prepare("insert into inventory_reservations (id, cart_id, product_id, sku, quantity, status, expires_at) values (?, ?, ?, ?, 1, 'active', datetime('now', '+1 hour'))");
  let accepted = 0;
  for (let index = 0; index < 20; index += 1) {
    try { insert.run(`r_${index}`, `c_${index}`, product.id, product.sku); accepted += 1; }
    catch (error) { assert.match(String(error), /INSUFFICIENT_STOCK/); }
  }
  assert.equal(accepted, 1);
  assert.throws(() => db.prepare("update products set stock = stock - 2 where id = ?").run(product.id), /INSUFFICIENT_STOCK/);
  assert.equal(db.prepare("select stock from products where id = ?").get(product.id).stock, 1);
});

test("refund ledger accumulates partial refunds without returning stock or exceeding payment", () => {
  const db = migratedDatabase();
  const product = db.prepare("select id, stock from products limit 1").get();
  db.prepare("insert into orders (id, number, email, state, payload_json, total, currency) values ('ord_test', 'AETH-TEST', 'buyer@example.test', 'paid', '{}', 1000, 'COP')").run();
  db.prepare("insert into payments (id, order_id, provider, provider_ref, status, amount, currency) values ('pay_test', 'ord_test', 'stripe', 'pi_test', 'paid', 1000, 'COP')").run();
  assert.equal(db.prepare("select order_id from payments where provider_ref = ?").get("pi_test").order_id, "ord_test");
  const insert = db.prepare("insert into refunds (id, payment_id, amount, reason, status) values (?, 'pay_test', ?, 'test', 'succeeded')");
  insert.run("re_1", 300);
  db.prepare("insert into refunds (id, payment_id, amount, reason, status) values ('re_pending', 'pay_test', 100, 'awaiting provider', 'pending')").run();
  assert.equal(db.prepare("select payment_status from orders where id = 'ord_test'").get().payment_status, "partially_refunded");
  assert.equal(db.prepare("select sum(amount) as amount from refunds where payment_id = 'pay_test' and status = 'succeeded'").get().amount, 300);
  insert.run("re_2", 200);
  assert.equal(db.prepare("select payment_status from orders where id = 'ord_test'").get().payment_status, "partially_refunded");
  insert.run("re_3", 500);
  assert.equal(db.prepare("select payment_status from orders where id = 'ord_test'").get().payment_status, "refunded");
  assert.throws(() => insert.run("re_4", 1), /REFUND_AMOUNT_EXCEEDS_PAYMENT/);
  assert.equal(db.prepare("select stock from products where id = ?").get(product.id).stock, product.stock);
});

test("pending provider refunds affect the order only after success and failed refunds can be retried", () => {
  const db = migratedDatabase();
  db.prepare("insert into orders (id, number, email, state, payment_status, payload_json, total, currency) values ('ord_pending', 'AETH-PENDING', 'buyer@example.test', 'paid', 'paid', '{}', 1000, 'COP')").run();
  db.prepare("insert into payments (id, order_id, provider, provider_ref, status, amount, currency) values ('pay_pending', 'ord_pending', 'stripe', 'pi_pending', 'paid', 1000, 'COP')").run();
  const insert = db.prepare("insert into refunds (id, payment_id, amount, reason, status) values (?, 'pay_pending', ?, 'test', 'pending')");
  insert.run("re_success", 400);
  assert.equal(db.prepare("select payment_status from orders where id = 'ord_pending'").get().payment_status, "paid");
  db.prepare("update refunds set status = 'succeeded' where id = 're_success'").run();
  assert.equal(db.prepare("select payment_status from orders where id = 'ord_pending'").get().payment_status, "partially_refunded");
  insert.run("re_failed", 600);
  db.prepare("update refunds set status = 'failed' where id = 're_failed'").run();
  assert.equal(db.prepare("select payment_status from orders where id = 'ord_pending'").get().payment_status, "partially_refunded");
  insert.run("re_final", 600);
  db.prepare("update refunds set status = 'succeeded' where id = 're_final'").run();
  assert.equal(db.prepare("select payment_status from orders where id = 'ord_pending'").get().payment_status, "refunded");
  insert.run("re_excess", 1);
  assert.throws(() => db.prepare("update refunds set status = 'succeeded' where id = 're_excess'").run(), /REFUND_AMOUNT_EXCEEDS_PAYMENT/);
});
