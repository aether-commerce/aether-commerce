import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const registry = "https://npm.pkg.github.com";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function planPackagePublishResume(packages) {
  const missing = [];
  for (const pkg of packages) {
    if (pkg.published) continue;
    if (!pkg.changedInRelease) {
      throw new Error(`Unrelated unpublished version ${pkg.name}@${pkg.version}; refusing to publish from this checkout.`);
    }
    missing.push(`${pkg.name}@${pkg.version}`);
  }
  return missing;
}

function isPublished(name, version) {
  try {
    const output = execFileSync("npm", ["view", `${name}@${version}`, "version", "--json", "--registry", registry], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (JSON.parse(output) !== version) throw new Error(`Registry version mismatch for ${name}@${version}.`);
    return true;
  } catch (error) {
    if (/\bE404\b/.test(String(error.stderr ?? ""))) return false;
    throw error;
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
    return { ...current, changedInRelease: current.version !== previous?.version };
  }).filter((pkg) => pkg.private === false);
  if (!packages.some((pkg) => pkg.changedInRelease)) throw new Error("The release SHA changes no public package versions.");
  const states = packages.map((pkg) => {
    if (!pkg.name?.startsWith("@aether-commerce/") || pkg.publishConfig?.registry !== registry) {
      throw new Error(`Unexpected package identity or registry for ${pkg.name ?? "unknown"}.`);
    }
    return { ...pkg, published: isPublished(pkg.name, pkg.version) };
  });
  const missing = planPackagePublishResume(states);
  console.log(missing.length ? `Missing release versions: ${missing.join(", ")}.` : "All release versions already exist; publish will skip them.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { run(); } catch (error) {
    console.error(`::error::Package publish resume refused: ${error.message}`);
    process.exitCode = 1;
  }
}
