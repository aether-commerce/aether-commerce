import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsDirectory = join(process.cwd(), "database", "core", "migrations");

test("all core D1 migrations apply with foreign keys enabled", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");

  const migrations = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const migration of migrations) {
    if (migration === "0034_product_timestamps_iso.sql") {
      database.prepare(
        "UPDATE products SET created_at = ?, updated_at = ? WHERE id = 'prd_0001'"
      ).run("2024-10-01 00:00:00", "2026-10-10 00:41:10");
    }
    assert.doesNotThrow(
      () => database.exec(readFileSync(join(migrationsDirectory, migration), "utf8")),
      `migration failed: ${migration}`
    );
  }

  assert.deepEqual(database.prepare("PRAGMA foreign_key_check;").all(), []);
  assert.ok(database.prepare("SELECT count(*) AS count FROM products;").get().count > 0);
  assert.ok(database.prepare("SELECT count(*) AS count FROM store_categories;").get().count > 0);
  const normalizedProduct = database.prepare("SELECT created_at, updated_at FROM products WHERE id = 'prd_0001';").get();
  assert.equal(normalizedProduct.created_at, "2024-10-01T00:00:00.000Z");
  assert.equal(normalizedProduct.updated_at, "2026-10-10T00:41:10.000Z");
  for (const table of ["product_cache", "product_overrides", "category_overrides"]) {
    assert.equal(
      database.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?;").get(table).count,
      0,
      `${table} should be removed by the legacy catalog cleanup migration`
    );
  }
  assert.match(
    readFileSync(join(migrationsDirectory, "0026_store_category_scope.sql"), "utf8"),
    /PRAGMA defer_foreign_keys\s*=\s*ON/i
  );
});


test("Wompi order-channel migration preserves existing orders and payment references", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  for (const migration of ["0001_initial.sql", "0003_required_commerce_schema.sql", "0015_order_channel_status.sql"]) {
    database.exec(readFileSync(join(migrationsDirectory, migration), "utf8"));
  }

  const insertOrder = database.prepare(
    "INSERT INTO orders (id, number, email, state, payload_json, total, channel) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  insertOrder.run("ord_stripe", "1001", "stripe@example.com", "created", "{}", 119000, "stripe");
  insertOrder.run("ord_whatsapp", "1002", "whatsapp@example.com", "created", "{}", 119000, "whatsapp");
  database.prepare(
    "INSERT INTO payments (id, order_id, provider, status, amount) VALUES (?, ?, ?, ?, ?)"
  ).run("pay_whatsapp", "ord_whatsapp", "whatsapp", "pending", 119000);

  database.exec(readFileSync(join(migrationsDirectory, "0035_order_wompi_channel.sql"), "utf8"));

  assert.deepEqual(
    database.prepare("SELECT id, channel FROM orders ORDER BY id").all().map((row) => ({ ...row })),
    [
      { id: "ord_stripe", channel: "stripe" },
      { id: "ord_whatsapp", channel: "whatsapp" }
    ]
  );
  assert.equal(database.prepare("SELECT order_id FROM payments WHERE id = 'pay_whatsapp'").get().order_id, "ord_whatsapp");
  insertOrder.run("ord_wompi", "1003", "wompi@example.com", "created", "{}", 119000, "wompi");
  assert.throws(
    () => insertOrder.run("ord_unknown", "1004", "unknown@example.com", "created", "{}", 119000, "unknown"),
    /CHECK constraint failed/
  );
  assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
});
