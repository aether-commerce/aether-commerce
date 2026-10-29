import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { create } from "tar";
import { assertEquivalentArchives } from "../scripts/package-archive-integrity.mjs";

test("compares package contents while allowing JSON object order, and enforces registry integrity", () => {
  const root = mkdtempSync(join(tmpdir(), "aether-archive-test-"));
  try {
    const local = join(root, "local"), remote = join(root, "remote");
    for (const dir of [local, remote]) mkdirSync(join(dir, "package"), { recursive: true });
    writeFileSync(join(local, "package/package.json"), '{"name":"demo","dependencies":{"a":"1","b":"2"}}');
    writeFileSync(join(remote, "package/package.json"), '{"dependencies":{"b":"2","a":"1"},"name":"demo"}');
    for (const dir of [local, remote]) writeFileSync(join(dir, "package/index.js"), "export const value = 1;\n");
    const pack = (dir) => { const output = join(dir, "test.tgz"); create({ cwd: dir, file: output, sync: true, gzip: true }, ["package"]); return output; };
    const localArchive = pack(local), remoteArchive = pack(remote);
    const integrity = `sha512-${createHash("sha512").update(readFileSync(remoteArchive)).digest("base64")}`;
    assert.doesNotThrow(() => assertEquivalentArchives(localArchive, remoteArchive, integrity));
    assert.throws(() => assertEquivalentArchives(localArchive, remoteArchive, "sha512-invalid"), /registry integrity/);
    writeFileSync(join(local, "package/index.js"), "export const value = 2;\n");
    pack(local);
    assert.throws(() => assertEquivalentArchives(localArchive, remoteArchive, integrity), /contents differ/);
    writeFileSync(join(local, "package/index.js"), "export const value = 1;\n");
    writeFileSync(join(local, "package/package.json"), '{"name":"demo","dependencies":{"a":"9","b":"2"}}');
    pack(local);
    assert.throws(() => assertEquivalentArchives(localArchive, remoteArchive, integrity), /contents differ/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
