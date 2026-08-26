#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(packageRoot, "admin-routes.manifest.json");

function readManifest() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.routes) || typeof manifest.package !== "string") {
    throw new Error(`Invalid admin route manifest: ${manifestPath}`);
  }
  return manifest;
}

function wrapperFor(manifest, route) {
  return `export { ${route.export} as default } from "${manifest.package}";\n`;
}

function routeTarget(adminAppDirectory, routeFile) {
  const target = resolve(adminAppDirectory, routeFile);
  const relativeTarget = relative(adminAppDirectory, target);
  if (relativeTarget === ".." || relativeTarget.startsWith(`..${sep}`)) {
    throw new Error(`Admin route escapes the app directory: ${routeFile}`);
  }
  return target;
}

export function syncAdminRoutes(adminAppDirectory, { quiet = false } = {}) {
  const manifest = readManifest();
  const destination = resolve(adminAppDirectory);
  const created = [];
  const preserved = [];

  for (const route of manifest.routes) {
    if (typeof route.file !== "string" || typeof route.export !== "string") {
      throw new Error("Invalid route entry in admin route manifest");
    }
    const target = routeTarget(destination, route.file);
    if (existsSync(target)) {
      preserved.push(route.file);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, wrapperFor(manifest, route));
    created.push(route.file);
  }

  if (!quiet) {
    console.log(`Admin routes synchronized: ${created.length} created, ${preserved.length} preserved.`);
    for (const route of created) console.log(`  created ${route}`);
  }
  return { created, preserved };
}

export function checkAdminRoutes(adminAppDirectory) {
  const manifest = readManifest();
  const destination = resolve(adminAppDirectory);
  const missing = manifest.routes
    .filter((route) => !existsSync(routeTarget(destination, route.file)))
    .map((route) => route.file);
  if (missing.length > 0) {
    throw new Error(`Missing admin routes:\n${missing.map((route) => `  ${route}`).join("\n")}`);
  }
  console.log(`Admin route check passed: ${manifest.routes.length} routes present.`);
  return true;
}

function main() {
  const [command = "sync", appDirectory = "apps/admin/app"] = process.argv.slice(2);
  if (command === "sync") {
    syncAdminRoutes(appDirectory);
    return;
  }
  if (command === "check") {
    checkAdminRoutes(appDirectory);
    return;
  }
  throw new Error(`Unknown command '${command}'. Use 'sync' or 'check'.`);
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) main();
