import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const virtualStore = fileURLToPath(new URL("../node_modules/.pnpm/", import.meta.url));
const packagePath = (name, markerPath, marker) => {
  const directory = readdirSync(virtualStore).find((entry) => {
    if (!entry.startsWith(`${name}@`) || !entry.includes("patch_hash=")) return false;
    return readFileSync(join(virtualStore, entry, "node_modules", name, markerPath), "utf8").includes(marker);
  });
  assert.ok(directory, `pnpm patched package ${name} must be installed`);
  return join(virtualStore, directory, "node_modules", name);
};
const braces = require(packagePath("braces", "lib/parse.js", "depth >= 256"));
const { sprintf } = require(packagePath("sprintf-js", "src/sprintf.js", "Math.min(100"));

test("braces rejects deeply nested patterns before recursive AST walkers", () => {
  const nestedPattern = `${"{".repeat(1_000)}x${"}".repeat(1_000)}`;
  assert.throws(() => braces.compile(nestedPattern), /maximum depth/);
  assert.deepEqual(braces.expand("{a,b}"), ["a", "b"]);
});

test("sprintf-js bounds excessive numeric precision instead of throwing RangeError", () => {
  const output = sprintf("%.100000000f", 1.25);
  assert.equal(output.length, 102);
  assert.equal(output.slice(0, 4), "1.25");
});
