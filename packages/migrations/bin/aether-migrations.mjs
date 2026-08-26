#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(packageRoot, "client-migrations.manifest.json"), "utf8"));

function equivalentMigrationSql(left, right) {
  // A few historical packages changed only explanatory full-line comments.
  // D1 never receives those comments, so compare the executable SQL while
  // preserving every SQL line and every inline comment as immutable history.
  const executableLines = (source) => source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .map((line) => line.trimEnd())
    .filter(Boolean);
  return executableLines(left).join("\n") === executableLines(right).join("\n");
}

export function syncMigrations(destination) {
  if (typeof destination !== "string" || !destination.trim()) {
    throw new Error("A destination directory is required.");
  }

  const targetDirectory = resolve(process.cwd(), destination);
  mkdirSync(targetDirectory, { recursive: true });
  const added = [];

  for (const migration of manifest.migrations) {
    const source = resolve(packageRoot, "migrations", migration);
    const target = resolve(targetDirectory, migration);
    if (!existsSync(source)) throw new Error(`Published migration is missing: ${migration}`);
    if (existsSync(target)) {
      if (!equivalentMigrationSql(readFileSync(source, "utf8"), readFileSync(target, "utf8"))) {
        throw new Error(`Migration ${migration} differs from Aether's immutable source.`);
      }
      continue;
    }
    copyFileSync(source, target);
    added.push(migration);
  }

  return { added, total: manifest.migrations.length, destination: targetDirectory };
}

export function checkMigrations(destination) {
  if (typeof destination !== "string" || !destination.trim()) {
    throw new Error("A destination directory is required.");
  }

  const targetDirectory = resolve(process.cwd(), destination);
  const missing = [];

  for (const migration of manifest.migrations) {
    const source = resolve(packageRoot, "migrations", migration);
    const target = resolve(targetDirectory, migration);
    if (!existsSync(source)) throw new Error(`Published migration is missing: ${migration}`);
    if (!existsSync(target)) {
      missing.push(migration);
      continue;
    }
    if (!equivalentMigrationSql(readFileSync(source, "utf8"), readFileSync(target, "utf8"))) {
      throw new Error(`Migration ${migration} differs from Aether's immutable source.`);
    }
  }

  if (missing.length) {
    throw new Error(`Client is missing Aether migrations: ${missing.join(", ")}`);
  }

  return { total: manifest.migrations.length, destination: targetDirectory };
}

// Package managers execute this binary through a symlink. Resolve it before
// comparing paths so the installed executable works as well as the source file.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, destination = "database/migrations"] = process.argv.slice(2);
  if (command === "sync") {
    const result = syncMigrations(destination);
    console.log(result.added.length ? `Added ${result.added.join(", ")}` : `All ${result.total} Aether migrations are present.`);
  } else if (command === "check") {
    const result = checkMigrations(destination);
    console.log(`Aether migrations verified: ${result.total} immutable migrations are present.`);
  } else {
    throw new Error("Usage: aether-migrations <sync|check> [database/migrations]");
  }
}
