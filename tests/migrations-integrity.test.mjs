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
    assert.doesNotThrow(
      () => database.exec(readFileSync(join(migrationsDirectory, migration), "utf8")),
      `migration failed: ${migration}`
    );
  }

  assert.deepEqual(database.prepare("PRAGMA foreign_key_check;").all(), []);
  assert.ok(database.prepare("SELECT count(*) AS count FROM products;").get().count > 0);
  assert.ok(database.prepare("SELECT count(*) AS count FROM store_categories;").get().count > 0);
  assert.match(
    readFileSync(join(migrationsDirectory, "0026_store_category_scope.sql"), "utf8"),
    /PRAGMA defer_foreign_keys\s*=\s*ON/i
  );
});
