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
