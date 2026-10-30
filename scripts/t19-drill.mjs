import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const packageName = "@aether-commerce/migrations";
const shaPattern = /^[a-f0-9]{40}$/i;
const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

export function drillDecision({ target, parent, event, resume, packages }) {
  if (!target) return { enabled: false };
  if (!shaPattern.test(target)) throw new Error("T19 drill target must be a full SHA.");
  if (event !== "workflow_run" || resume || target !== parent) return { enabled: false };
  if (packages.length < 2 || !packages.some((pkg) => pkg.name === packageName))
    throw new Error("T19 drill requires at least two changed public packages, including migrations.");
  if (packages.some((pkg) => pkg.published !== false))
    throw new Error("T19 drill requires every changed package version to be unpublished.");
  return { enabled: true, packageName };
}

function registryHasVersion(name, version) {
  try {
    execFileSync("npm", ["view", `${name}@${version}`, "version", "--registry", "https://npm.pkg.github.com"], { stdio: ["ignore", "pipe", "pipe"] });
    return true;
  } catch (error) {
    if (/\bE404\b/.test(String(error.stderr ?? ""))) return false;
    throw error;
  }
}

function main() {
  const target = process.env.AETHER_T19_DRILL_HEAD || "";
  const sha = process.env.RELEASE_SHA || "";
  const event = process.env.GITHUB_EVENT_NAME || "";
  const resume = Boolean(process.env.RELEASE_RESUME_SHA);
  if (!target || event !== "workflow_run" || resume) return console.log("disabled");
  if (!shaPattern.test(sha) || !shaPattern.test(target)) throw new Error("T19 drill needs full SHAs.");
  let parent;
  try { parent = git("rev-parse", `${sha}^2`); } catch { throw new Error("T19 drill requires a merge commit."); }
  if (target !== parent) return console.log("disabled");
  const paths = git("diff", "--name-only", `${sha}^`, sha, "--", "packages")
    .split(/\r?\n/).filter((path) => /^packages\/[^/]+\/package\.json$/.test(path));
  const packages = paths.map((path) => {
    const current = JSON.parse(git("show", `${sha}:${path}`));
    let previous; try { previous = JSON.parse(git("show", `${sha}^:${path}`)); } catch { previous = {}; }
    return { ...current, changed: current.version !== previous.version };
  }).filter((pkg) => pkg.private === false && pkg.changed);
  for (const pkg of packages) {
    if (!pkg.name?.startsWith("@aether-commerce/") || pkg.publishConfig?.registry !== "https://npm.pkg.github.com")
      throw new Error("T19 drill encountered an unexpected package identity or registry.");
    pkg.published = registryHasVersion(pkg.name, pkg.version);
  }
  const decision = drillDecision({ target, parent, event, resume, packages });
  console.log(decision.enabled ? "enabled" : "disabled");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(`::error::T19 drill refused: ${error.message}`); process.exitCode = 1; }
}
