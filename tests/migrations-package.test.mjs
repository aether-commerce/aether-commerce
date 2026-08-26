import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkMigrations, syncMigrations } from "../packages/migrations/bin/aether-migrations.mjs";

const manifest = JSON.parse(readFileSync(new URL("../packages/migrations/client-migrations.manifest.json", import.meta.url), "utf8"));

test("published migration sync adds missing files and protects immutable history", () => {
  const root = mkdtempSync(join(tmpdir(), "aether-published-migrations-"));
  try {
    const first = syncMigrations(root);
    assert.equal(first.added.at(-1), manifest.migrations.at(-1));
    assert.match(readFileSync(join(root, "0022_restock_notifications.sql"), "utf8"), /restock_notifications/i);
    assert.deepEqual(syncMigrations(root).added, []);
    assert.equal(checkMigrations(root).total, manifest.migrations.length);

    writeFileSync(join(root, "0001_initial.sql"), "CREATE TABLE incompatible_history (id INTEGER);\n");
    assert.throws(() => syncMigrations(root), /differs from Aether's immutable source/);
    assert.throws(() => checkMigrations(root), /differs from Aether's immutable source/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("published migration sync accepts historical comment-only changes", () => {
  const root = mkdtempSync(join(tmpdir(), "aether-published-migrations-"));
  try {
    syncMigrations(root);
    const migrationPath = join(root, "0001_initial.sql");
    writeFileSync(migrationPath, `-- Client-local documentation\n${readFileSync(migrationPath, "utf8")}`);
    assert.equal(checkMigrations(root).total, manifest.migrations.length);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("published migration check reports a missing migration without writing", () => {
  const root = mkdtempSync(join(tmpdir(), "aether-published-migrations-"));
  try {
    assert.throws(() => checkMigrations(root), /Client is missing Aether migrations/);
    assert.equal(syncMigrations(root).total, manifest.migrations.length);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
