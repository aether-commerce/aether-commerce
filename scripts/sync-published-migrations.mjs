import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreDirectory = resolve(root, "database/core");
const packageDirectory = resolve(root, "packages/migrations");
const coreManifestPath = resolve(coreDirectory, "client-migrations.manifest.json");
const packageManifestPath = resolve(packageDirectory, "client-migrations.manifest.json");
const coreManifest = JSON.parse(readFileSync(coreManifestPath, "utf8"));
const previousPackageManifest = JSON.parse(readFileSync(packageManifestPath, "utf8"));
const destinationDirectory = resolve(packageDirectory, "migrations");

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

if (!Array.isArray(coreManifest.migrations)) throw new Error("Core migration manifest must contain a migrations array.");
mkdirSync(destinationDirectory, { recursive: true });

const added = [];
for (const migration of coreManifest.migrations) {
  const source = resolve(coreDirectory, "migrations", migration);
  const destination = resolve(destinationDirectory, migration);
  if (!existsSync(source)) throw new Error(`Core migration is missing: ${migration}`);
  if (existsSync(destination)) {
    if (!equivalentMigrationSql(readFileSync(source, "utf8"), readFileSync(destination, "utf8"))) {
      throw new Error(`Refusing to overwrite immutable published migration: ${migration}`);
    }
    continue;
  }
  copyFileSync(source, destination);
  added.push(migration);
}

writeFileSync(
  packageManifestPath,
  `${JSON.stringify({
    ...previousPackageManifest,
    description: coreManifest.description ?? previousPackageManifest.description,
    migrations: coreManifest.migrations
  }, null, 2)}\n`
);

console.log(added.length ? `Added published migrations: ${added.join(", ")}` : "Published migrations already match Aether core.");
