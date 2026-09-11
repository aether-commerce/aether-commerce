#!/usr/bin/env node

// Thin operational client for the store-scoped Worker endpoint. The
// normalization and image transfer stay server-side so this command never
// needs D1 or Cloudinary credentials.
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value?.startsWith("--")) continue;
  const [key, inline] = value.slice(2).split("=", 2);
  const next = process.argv[index + 1];
  const hasSeparateValue = inline === undefined && next !== undefined && !next.startsWith("--");
  args.set(key, inline ?? (hasSeparateValue ? next : "true"));
  if (hasSeparateValue) index += 1;
}

const apiUrl = args.get("api-url");
const token = args.get("token");
if (!apiUrl || !token) {
  throw new Error("Usage: node scripts/migrate-catalog.mjs --api-url <url> --token <token> [--execute] [--limit 25]");
}

const limit = Math.min(Math.max(Number(args.get("limit") ?? 25), 1), 100);
const execute = args.get("execute") === "true";
let afterId;
let total = 0;
let migrated = 0;
let errors = 0;

for (;;) {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/v1/admin/products/migrate-legacy`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ dryRun: !execute, limit, ...(afterId ? { afterId } : {}) })
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? `Migration request failed (${response.status})`);
  const report = payload.data;
  total += report.scanned;
  migrated += report.migrated;
  errors += report.errors.length;
  console.log(JSON.stringify(report));
  if (report.errors.length > 0 || !report.nextCursor) break;
  afterId = report.nextCursor;
}

console.error(`${execute ? "Executed" : "Audited"}: scanned=${total} migrated=${migrated} errors=${errors}`);
if (errors > 0) process.exitCode = 1;
