import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { list } from "tar";

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  return value;
}

export function archiveEntries(path) {
  const entries = new Map();
  list({ file: path, sync: true, strict: true, onentry(entry) {
    if (entry.type === "Directory") { entry.resume(); return; }
    if (entry.type !== "File" || !entry.path.startsWith("package/") || entry.path.split("/").includes("..") || entries.has(entry.path)) {
      throw new Error(`Invalid or duplicate package archive entry: ${entry.path}`);
    }
    if (entry.path === "package/package.json" && entry.size > 1024 * 1024) throw new Error("Package metadata is too large.");
    const hash = createHash("sha256");
    const chunks = [];
    entry.on("data", (chunk) => { if (entry.path === "package/package.json") chunks.push(chunk); else hash.update(chunk); });
    entry.on("end", () => {
      const digest = entry.path === "package/package.json"
        ? createHash("sha256").update(JSON.stringify(canonicalJson(JSON.parse(Buffer.concat(chunks).toString("utf8"))))).digest("hex")
        : hash.digest("hex");
      entries.set(entry.path, `${entry.mode & 0o111}:${digest}`);
    });
  } });
  if (!entries.has("package/package.json")) throw new Error("Package archive is missing package.json.");
  return entries;
}

export function assertEquivalentArchives(workspace, published, expectedIntegrity) {
  const digest = `sha512-${createHash("sha512").update(readFileSync(published)).digest("base64")}`;
  if (!expectedIntegrity.split(/\s+/).includes(digest)) throw new Error("Published archive does not match registry integrity.");
  const actual = archiveEntries(workspace);
  const expected = archiveEntries(published);
  if (actual.size !== expected.size || [...actual].some(([path, hash]) => expected.get(path) !== hash)) {
    throw new Error("Workspace package contents differ from the published registry artifact.");
  }
}

export function verifyWorkspacePackage(name, version, packageDirectory, expectedIntegrity) {
  const directory = mkdtempSync(join(tmpdir(), "aether-package-compare-"));
  try {
    const workspace = join(directory, "workspace");
    const registry = join(directory, "registry");
    mkdirSync(workspace); mkdirSync(registry);
    execFileSync("pnpm", ["pack", "--pack-destination", workspace], { cwd: packageDirectory, stdio: "pipe" });
    execFileSync("npm", ["pack", `${name}@${version}`, "--pack-destination", registry, "--registry", "https://npm.pkg.github.com"], { stdio: "pipe" });
    const localArchive = readdirSync(workspace).find((file) => file.endsWith(".tgz"));
    const remoteArchive = readdirSync(registry).find((file) => file.endsWith(".tgz"));
    if (!localArchive || !remoteArchive) throw new Error(`Package archive missing for ${name}@${version}.`);
    assertEquivalentArchives(join(workspace, localArchive), join(registry, remoteArchive), expectedIntegrity);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
