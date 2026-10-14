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

  const catalogSpecifications = [
    ["cargador-gan-30w", "Potencia", "30 W"],
    ["cargador-dual-usb-c-45w", "Potencia", "45 W"],
    ["cargador-inalambrico-15w", "Potencia", "15 W"],
    ["cargador-de-auto-20w", "Potencia", "20 W"],
    ["cargador-gan-65w", "Potencia", "65 W"],
    ["cargador-inalambrico-stand-10w", "Potencia", "10 W"],
    ["power-bank-10000mah", "Capacidad", "10.000 mAh"],
    ["power-bank-20000mah", "Capacidad", "20.000 mAh"],
    ["power-bank-slim-5000mah", "Capacidad", "5.000 mAh"],
    ["power-bank-solar-15000mah", "Capacidad", "15.000 mAh"],
    ["power-bank-magsafe-5000mah", "Capacidad", "5.000 mAh"]
  ];
  for (const [slug, key, value] of catalogSpecifications) {
    const row = database.prepare("SELECT details_json FROM products WHERE slug = ?;").get(slug);
    assert.ok(row, `product should exist: ${slug}`);
    const details = JSON.parse(row.details_json);
    assert.equal(details.specs[key], value, `${slug} should have its explicit ${key}`);
    assert.ok(details.highlights.includes(`${key}: ${value}`), `${slug} highlights should match its ${key}`);
  }
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

test("demo catalog specification migration preserves administrator edits", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(readFileSync(join(migrationsDirectory, "0013_products_table.sql"), "utf8"));
  database.exec(readFileSync(join(migrationsDirectory, "0014_seed_products_from_json.sql"), "utf8"));
  database.prepare(
    "UPDATE products SET details_json = json_set(details_json, '$.specs.Potencia', ?, '$.highlights[0]', ?) WHERE slug = ?;"
  ).run("Verified manually", "Potencia: verified manually", "cargador-gan-65w");

  database.exec(readFileSync(join(migrationsDirectory, "0036_demo_catalog_specifications.sql"), "utf8"));
  const details = JSON.parse(
    database.prepare("SELECT details_json FROM products WHERE slug = ?;").get("cargador-gan-65w").details_json
  );
  assert.equal(details.specs.Potencia, "Verified manually");
  assert.ok(details.highlights.includes("Potencia: verified manually"));
  assert.equal(
    JSON.parse(database.prepare("SELECT details_json FROM products WHERE slug = ?;").get("cargador-inalambrico-15w").details_json).specs.Potencia,
    "15 W"
  );
});
