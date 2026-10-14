import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const gitExecutable =
  process.platform === "win32" ? "C:\\Program Files\\Git\\cmd\\git.exe" : "/usr/bin/git";

function git(args) {
  return execFileSync(gitExecutable, args, { encoding: "utf8" });
}

export function releaseBranchErrors(rows, packages) {
  const publicPackageDirectories = new Set(
    packages.filter((pkg) => pkg.private === false).map((pkg) => "packages/" + pkg.directory)
  );
  const consumedNotes = [];
  const affectedPackages = new Map();
  const errors = [];

  for (const row of rows) {
    const [status, ...paths] = row.split("\t");
    if (!status || paths.length === 0) continue;
    if (status.startsWith("D") && paths.length === 1 && /^\.changeset\/[^/]+\.md$/.test(paths[0])) {
      consumedNotes.push(paths[0]);
      continue;
    }
    if (paths.length !== 1) {
      errors.push("renamed paths are not allowed in a release PR: " + paths.join(" -> "));
      continue;
    }

    const path = paths[0];
    const packageDirectory = [...publicPackageDirectories].find((directory) =>
      path.startsWith(directory + "/")
    );
    const artifact = packageDirectory ? path.slice(packageDirectory.length + 1) : "";
    if (!packageDirectory || !["package.json", "CHANGELOG.md"].includes(artifact)) {
      errors.push("non-generated path is not allowed in a release PR: " + path);
      continue;
    }
    if (!affectedPackages.has(packageDirectory)) affectedPackages.set(packageDirectory, new Set());
    affectedPackages.get(packageDirectory).add(artifact);
  }

  if (consumedNotes.length === 0) errors.push("release branch must consume at least one changeset");
  if (affectedPackages.size === 0) errors.push("release branch must update at least one public package");
  for (const [directory, files] of affectedPackages) {
    if (!files.has("package.json")) errors.push("release package metadata is missing: " + directory + "/package.json");
  }
  return errors;
}

function run() {
  const base = process.argv.find((arg) => arg.startsWith("--base="))?.slice("--base=".length) ?? "origin/develop";
  const rows = git(["diff", "--name-status", base])
    .split(/\r?\n/)
    .filter(Boolean);
  const packages = readdirSync("packages", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const manifestPath = resolve("packages", entry.name, "package.json");
      if (!existsSync(manifestPath)) return [];
      return [{ directory: entry.name, ...JSON.parse(readFileSync(manifestPath, "utf8")) }];
    });
  const errors = releaseBranchErrors(rows, packages);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Release branch contains " + rows.length + " generated change(s) across public packages and consumes its changesets.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error("::error::" + error.message);
    process.exitCode = 1;
  }
}
