import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreDirectory = resolve(root, "database/core");
const packageDirectory = resolve(root, "packages/migrations");

function equivalentMigrationSql(left, right) {
  const executableLines = (source) => source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .map((line) => line.trimEnd())
    .filter(Boolean);
  return executableLines(left).join("\n") === executableLines(right).join("\n");
}

function readManifest(directory) {
  const path = resolve(directory, "client-migrations.manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(manifest.migrations)) throw new Error(`${path} must contain a migrations array.`);
  return manifest.migrations;
}

function assertManifest(name, migrations) {
  const seen = new Set();
  for (const migration of migrations) {
    if (typeof migration !== "string" || !/^\d{4}_[a-z0-9_]+\.sql$/.test(migration)) {
      throw new Error(`${name} has an invalid migration filename: ${migration}`);
    }
    if (seen.has(migration)) throw new Error(`${name} lists ${migration} more than once.`);
    seen.add(migration);
  }
}

const coreMigrations = readManifest(coreDirectory);
const packageMigrations = readManifest(packageDirectory);
assertManifest("Core client migration manifest", coreMigrations);
assertManifest("Published migration manifest", packageMigrations);

if (JSON.stringify(coreMigrations) !== JSON.stringify(packageMigrations)) {
  throw new Error(
    "Client migration manifests differ. Run `pnpm db:sync:published`, review the resulting package changes, and include them in the same release as the schema code."
  );
}

for (const migration of coreMigrations) {
  const corePath = resolve(coreDirectory, "migrations", migration);
  const packagePath = resolve(packageDirectory, "migrations", migration);
  if (!existsSync(corePath)) throw new Error(`Core migration is missing: ${migration}`);
  if (!existsSync(packagePath)) throw new Error(`Published migration is missing: ${migration}`);
  if (!equivalentMigrationSql(readFileSync(corePath, "utf8"), readFileSync(packagePath, "utf8"))) {
    throw new Error(`Published migration differs from core: ${migration}`);
  }
}

console.log(`client_migration_distribution_ok migrations=${coreMigrations.length}`);
