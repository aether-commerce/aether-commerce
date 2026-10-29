import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const registry = "https://npm.pkg.github.com";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function planPackagePublishResume(packages, verifyIntegrity = () => {}) {
  const missing = [];
  for (const pkg of packages) {
    if (pkg.published) continue;
    if (!pkg.changedInRelease) {
      throw new Error(`Unrelated unpublished version ${pkg.name}@${pkg.version}; refusing to publish from this checkout.`);
    }
    missing.push(`${pkg.name}@${pkg.version}`);
  }
  if (missing.length) {
    for (const pkg of packages) {
      if (pkg.published && pkg.changedInRelease) verifyIntegrity(pkg);
    }
  }
  return missing;
}

function isPublished(name, version) {
  try {
    const output = execFileSync("npm", ["view", `${name}@${version}`, "dist.integrity", "--json", "--registry", registry], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const integrity = JSON.parse(output);
    if (typeof integrity !== "string" || !integrity.startsWith("sha512-")) {
      throw new Error(`Registry integrity metadata is missing for ${name}@${version}.`);
    }
    return { published: true, integrity };
  } catch (error) {
    if (/\bE404\b/.test(String(error.stderr ?? ""))) return { published: false, integrity: null };
    throw error;
  }
}

function verifyWorkspaceTarball(pkg) {
  const directory = mkdtempSync(join(tmpdir(), "aether-resume-integrity-"));
  try {
    const packageDirectory = join(root, dirname(pkg.path));
    execFileSync("pnpm", ["pack", "--pack-destination", directory], {
      cwd: packageDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const archive = readdirSync(directory).find((filename) => filename.endsWith(".tgz"));
    if (!archive) throw new Error(`Workspace pack did not produce a tarball for ${pkg.name}@${pkg.version}.`);
    const digest = `sha512-${createHash("sha512").update(readFileSync(join(directory, archive))).digest("base64")}`;
    if (digest !== pkg.integrity) {
      throw new Error(`Published integrity differs from the authorized release source for ${pkg.name}@${pkg.version}.`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function run() {
  const sha = process.env.RELEASE_SHA ?? "";
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error("RELEASE_SHA must be a full commit SHA.");
  const paths = git(["ls-tree", "-r", "--name-only", sha, "--", "packages"])
    .split(/\r?\n/)
    .filter((path) => /^packages\/[^/]+\/package\.json$/.test(path));
  const packages = paths.map((path) => {
    const current = JSON.parse(git(["show", `${sha}:${path}`]));
    const previousSource = (() => {
      try { return git(["show", `${sha}^:${path}`]); } catch { return null; }
    })();
    const previous = previousSource ? JSON.parse(previousSource) : null;
    return { ...current, path, changedInRelease: current.version !== previous?.version };
  }).filter((pkg) => pkg.private === false);
  if (!packages.some((pkg) => pkg.changedInRelease)) throw new Error("The release SHA changes no public package versions.");
  const states = packages.map((pkg) => {
    if (!pkg.name?.startsWith("@aether-commerce/") || pkg.publishConfig?.registry !== registry) {
      throw new Error(`Unexpected package identity or registry for ${pkg.name ?? "unknown"}.`);
    }
    return { ...pkg, ...isPublished(pkg.name, pkg.version) };
  });
  const missing = planPackagePublishResume(states, verifyWorkspaceTarball);
  console.log(missing.length ? `Missing release versions: ${missing.join(", ")}.` : "All release versions already exist; publish will skip them.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { run(); } catch (error) {
    console.error(`::error::Package publish resume refused: ${error.message}`);
    process.exitCode = 1;
  }
}
