import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createReleaseManifest, sha256, serializeReleaseManifest } from "./release-manifest.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function maybeGitShow(revision, path) {
  try {
    return execFileSync("git", ["show", `${revision}:${path}`], { cwd: root, encoding: "utf8" });
  } catch {
    return null;
  }
}

export function shouldVerifyWorkspaceTarball(changedInRelease, resumeRelease = false) {
  return changedInRelease && !resumeRelease;
}

function packageDist(name, version, packageDirectory, changedInRelease, resumeRelease) {
  let metadata;
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const raw = execFileSync("npm", ["view", `${name}@${version}`, "name", "version", "dist", "--json", "--registry", "https://npm.pkg.github.com"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });
      metadata = JSON.parse(raw);
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 6) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
    }
  }
  if (!metadata) throw new Error(`Registry metadata is not available for ${name}@${version} after six attempts: ${lastError?.message ?? "unknown error"}`);
  if (metadata.name !== name || metadata.version !== version) {
    throw new Error(`Registry returned unexpected metadata for ${name}@${version}.`);
  }
  if (!metadata.dist?.integrity || !metadata.dist?.tarball) {
    throw new Error(`Registry did not provide tarball integrity for ${name}@${version}.`);
  }
  if (shouldVerifyWorkspaceTarball(changedInRelease, resumeRelease)) {
    verifyWorkspaceTarball(name, version, packageDirectory, metadata.dist.integrity);
  }
  verifyPublishedTarball(name, version, metadata.dist.integrity);
  return metadata.dist;
}

function verifyWorkspaceTarball(name, version, packageDirectory, expectedIntegrity) {
  const directory = mkdtempSync(join(tmpdir(), "aether-source-package-"));
  try {
    execFileSync("pnpm", ["pack", "--pack-destination", directory], {
      cwd: packageDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const archive = readdirSync(directory).find((filename) => filename.endsWith(".tgz"));
    if (!archive) throw new Error(`Workspace pack did not produce a tarball for ${name}@${version}.`);
    const digest = `sha512-${createHash("sha512").update(readFileSync(join(directory, archive))).digest("base64")}`;
    if (!expectedIntegrity.split(/\s+/).includes(digest)) {
      throw new Error(`Workspace tarball differs from the published registry artifact for ${name}@${version}.`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function verifyPublishedTarball(name, version, expectedIntegrity) {
  const directory = mkdtempSync(join(tmpdir(), "aether-package-integrity-"));
  try {
    execFileSync("npm", ["pack", `${name}@${version}`, "--json", "--pack-destination", directory, "--registry", "https://npm.pkg.github.com"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const archive = readdirSync(directory).find((filename) => filename.endsWith(".tgz"));
    if (!archive) throw new Error(`Registry download did not produce a tarball for ${name}@${version}.`);
    const digest = `sha512-${createHash("sha512").update(readFileSync(join(directory, archive))).digest("base64")}`;
    if (!expectedIntegrity.split(/\s+/).includes(digest)) {
      throw new Error(`Downloaded tarball integrity does not match registry metadata for ${name}@${version}.`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function collectClientMigrations(releaseSha = git(["rev-parse", "HEAD"])) {
  const manifestPath = "packages/migrations/client-migrations.manifest.json";
  const manifestSource = maybeGitShow(releaseSha, manifestPath);
  if (manifestSource === null) throw new Error("Published client migration manifest is missing from the release commit.");
  const manifestBytes = Buffer.from(manifestSource, "utf8");
  const manifest = JSON.parse(manifestSource);
  if (!Array.isArray(manifest.migrations)) throw new Error("Published client migration manifest must contain a migrations array.");
  const files = manifest.migrations.map((filename) => {
    if (typeof filename !== "string" || !/^\d{4}_[a-z0-9_]+\.sql$/.test(filename)) {
      throw new Error(`Invalid published client migration filename: ${filename}`);
    }
    const migrationPath = `packages/migrations/migrations/${filename}`;
    const source = maybeGitShow(releaseSha, migrationPath);
    if (source === null) throw new Error(`Published client migration is missing from release commit: ${filename}`);
    const bytes = Buffer.from(source, "utf8");
    return {
      path: migrationPath,
      sha256: sha256(bytes)
    };
  });
  return { manifestSha256: sha256(manifestBytes), files };
}

export function assertReleaseCommitAvailable(releaseSha) {
  if (typeof releaseSha !== "string" || !/^[0-9a-f]{40}$/i.test(releaseSha)) {
    throw new Error("RELEASE_SHA must be a full commit SHA.");
  }
  try {
    git(["cat-file", "-e", `${releaseSha}^{commit}`]);
  } catch {
    throw new Error("Release commit is unavailable in checkout.");
  }
}

export function buildReleaseManifest({ baseSha, headSha, repository, createdAt, resumeRelease = false }) {
  const packagePaths = git(["ls-tree", "-r", "--name-only", headSha, "--", "packages"])
    .split(/\r?\n/)
    .filter((path) => /^packages\/[^/]+\/package\.json$/.test(path));
  const packages = [];
  for (const path of packagePaths) {
    const currentSource = maybeGitShow(headSha, path);
    if (!currentSource) throw new Error(`Package metadata is missing from release commit: ${path}`);
    const current = JSON.parse(currentSource);
    if (current.private === true) continue;
    if (!current.name?.startsWith("@aether-commerce/")) {
      throw new Error(`Public package is missing its Aether package identity: ${path}`);
    }
    if (current.publishConfig?.registry !== "https://npm.pkg.github.com") {
      throw new Error(`Public package is missing its GitHub Packages registry: ${path}`);
    }
    const previousSource = maybeGitShow(baseSha, path);
    const previous = previousSource ? JSON.parse(previousSource) : null;
    const changedInRelease = current.version !== previous?.version;
    const tag = `${current.name}@${current.version}`;
    const taggedSha = maybeGitShow(tag, path) === null ? null : git(["rev-list", "-n", "1", `refs/tags/${tag}`]);
    if (taggedSha) {
      const taggedPackage = JSON.parse(maybeGitShow(tag, path));
      if (taggedPackage.name !== current.name || taggedPackage.version !== current.version) {
        throw new Error(`Release tag ${tag} does not identify this package version.`);
      }
    }
    if (changedInRelease && taggedSha !== headSha) {
      throw new Error(`New package release tag ${tag} is missing or does not point to ${headSha}.`);
    }
    const dist = packageDist(current.name, current.version, dirname(join(root, path)), changedInRelease, resumeRelease);
    packages.push({
      name: current.name,
      version: current.version,
      registry: current.publishConfig.registry,
      integrity: dist.integrity,
      tarball: dist.tarball,
      tag: taggedSha ? tag : null,
      changedInRelease
    });
  }
  if (packages.length === 0) throw new Error("No public Aether packages were found in the release commit.");

  return createReleaseManifest({
    repository,
    sha: headSha,
    createdAt,
    packages,
    migrations: collectClientMigrations(headSha)
  });
}

function run() {
  const headSha = process.env.RELEASE_SHA || git(["rev-parse", "HEAD"]);
  const baseSha = process.env.RELEASE_BASE_SHA || git(["rev-parse", `${headSha}^`]);
  const repository = process.env.GITHUB_REPOSITORY || "";
  assertReleaseCommitAvailable(headSha);
  const createdAt = git(["show", "-s", "--format=%cI", headSha]);
  const output = process.env.RELEASE_MANIFEST_PATH || join(root, "release-manifest.v1.json");
  const manifest = buildReleaseManifest({
    baseSha,
    headSha,
    repository,
    createdAt,
    resumeRelease: process.env.RELEASE_RESUME === "true"
  });
  writeFileSync(output, serializeReleaseManifest(manifest), { flag: "wx" });
  console.log(`Created ${output} for ${manifest.packages.length} package(s), ${manifest.migrations.files.length} migration(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(`::error::Unable to create release manifest: ${error.message}`);
    process.exitCode = 1;
  }
}
