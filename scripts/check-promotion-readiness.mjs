import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const gitExecutable =
  process.platform === "win32" ? "C:\\Program Files\\Git\\cmd\\git.exe" : "/usr/bin/git";

function git(args) {
  return execFileSync(gitExecutable, args, { encoding: "utf8" });
}

function resolveBase() {
  const requested = process.env.PROMOTION_BASE_REF?.trim() || "main";
  const candidates = requested.startsWith("origin/")
    ? [requested]
    : ["origin/" + requested, requested];
  for (const candidate of candidates) {
    try {
      git(["rev-parse", "--verify", candidate + "^{commit}"]);
      return candidate;
    } catch {
      // Keep checking explicit candidates before returning an actionable error.
    }
  }
  throw new Error(
    "Promotion base '" + requested + "' is unavailable (tried " + candidates.join(", ") + ")."
  );
}

function parseVersion(value) {
  const match = String(value ?? "").match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/
  );
  if (!match) throw new Error("Invalid package version '" + value + "'.");
  return { core: match.slice(1, 4).map(Number), prerelease: match[4]?.split(".") ?? null };
}

function isGreaterVersion(next, previous) {
  const a = parseVersion(next);
  const b = parseVersion(previous);
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] > b.core[index];
  }
  if (a.prerelease === null) return b.prerelease !== null;
  if (b.prerelease === null) return false;
  const count = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < count; index += 1) {
    const left = a.prerelease[index];
    const right = b.prerelease[index];
    if (left === undefined) return true;
    if (right === undefined) return false;
    if (left === right) continue;
    const leftNumeric = /^\d+$/.test(left);
    const rightNumeric = /^\d+$/.test(right);
    if (leftNumeric && rightNumeric) return Number(left) > Number(right);
    if (leftNumeric !== rightNumeric) return !leftNumeric;
    return left > right;
  }
  return false;
}

function publicPackages() {
  return readdirSync("packages", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directory = "packages/" + entry.name;
      const manifestPath = resolve(directory, "package.json");
      if (!existsSync(manifestPath)) return null;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      return manifest.private === false ? { directory, manifestPath, manifest } : null;
    })
    .filter(Boolean);
}

function run() {
  const base = resolveBase();
  const changes = git(["diff", "--name-status", base + "...HEAD"])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [status, ...parts] = line.split("\t");
      return { status: status[0], path: parts.at(-1) };
    });

  const noteDirectory = resolve(".changeset");
  const pendingNotes = existsSync(noteDirectory)
    ? readdirSync(noteDirectory).filter((name) => name.endsWith(".md") && name !== "README.md")
    : [];
  const violations = [];
  if (pendingNotes.length) {
    violations.push(
      "unconsumed changesets remain: " + pendingNotes.map((name) => ".changeset/" + name).join(", ")
    );
  }

  const packages = publicPackages();
  const changedPackages = new Map();
  for (const { path } of changes) {
    if (!path) continue;
    const pkg = packages.find(({ directory }) => path.startsWith(directory + "/"));
    if (pkg) changedPackages.set(pkg.directory, pkg);
  }

  for (const [directory, pkg] of changedPackages) {
    const currentManifest = JSON.parse(readFileSync(pkg.manifestPath, "utf8"));
    let previousManifest;
    try {
      previousManifest = JSON.parse(git(["show", base + ":" + directory + "/package.json"]));
    } catch {
      previousManifest = null;
    }
    const updated = changes.some(({ path }) => path === directory + "/package.json");
    if (
      !updated ||
      !previousManifest?.version ||
      !isGreaterVersion(currentManifest.version, previousManifest.version)
    ) {
      violations.push(
        pkg.manifest.name +
          " changed in the promotion but has no valid package version increase from " +
          (previousManifest?.version ?? "a base version") +
          " to " +
          (currentManifest.version ?? "an unknown version")
      );
    }
  }

  if (violations.length) {
    for (const violation of violations)
      console.error("::error::Promotion is not ready: " + violation + ".");
    process.exitCode = 1;
    return;
  }

  console.log(
    "Promotion metadata is ready against " +
      base +
      ": no pending changesets; " +
      changedPackages.size +
      " changed public package(s) have increased versions."
  );
}

try {
  run();
} catch (error) {
  console.error("::error::Unable to verify promotion readiness: " + error.message);
  process.exitCode = 1;
}
