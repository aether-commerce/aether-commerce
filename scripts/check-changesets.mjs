import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const gitExecutable =
  process.platform === "win32" ? "C:\\Program Files\\Git\\cmd\\git.exe" : "/usr/bin/git";
const notePattern = /^\.changeset\/[^/]+\.md$/;

export function parseChangeset(source, publicPackages) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { error: "must contain valid Changesets frontmatter and a description" };

  const entries = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const entry = line.match(/^\s*["']?([^"':]+)["']?\s*:\s*(patch|minor|major)\s*$/);
    if (!entry)
      return {
        error: `invalid package or release level in frontmatter: ${line.trim() || "<empty line>"}`
      };
    const packageName = entry[1].trim();
    if (entries.has(packageName)) return { error: `duplicate package ${packageName}` };
    if (!publicPackages.has(packageName))
      return { error: `unknown or non-public package ${packageName}` };
    entries.set(packageName, entry[2]);
  }

  if (entries.size === 0) return { error: "must cover at least one public package" };
  if (!match[2].trim()) return { error: "must include a non-empty release description" };
  return { entries };
}

function git(args, options = {}) {
  return execFileSync(gitExecutable, args, { encoding: "utf8", ...options });
}

function resolveBase() {
  const argumentBase = process.argv
    .find((arg) => arg.startsWith("--base="))
    ?.slice("--base=".length);
  const environmentBase = process.env.GITHUB_BASE_REF?.trim();
  const requested = argumentBase || environmentBase || "origin/develop";
  const candidates = requested.startsWith("origin/")
    ? [requested]
    : ["origin/" + requested, requested];
  for (const candidate of candidates) {
    try {
      git(["rev-parse", "--verify", candidate + "^{commit}"]);
      return { name: requested, ref: candidate };
    } catch {
      // Try the next unambiguous candidate, then fail with all attempted refs.
    }
  }
  throw new Error(
    "Cannot validate changesets: base ref does not resolve to a commit (tried " +
      candidates.join(", ") +
      "). Fetch the base or pass --base=<ref>."
  );
}

function changedFiles(baseRef) {
  const rows = [
    ...git(["diff", "--name-status", baseRef + "...HEAD"]).split(/\r?\n/),
    ...git(["diff", "--name-status", "HEAD"]).split(/\r?\n/),
    ...git(["ls-files", "--others", "--exclude-standard"])
      .split(/\r?\n/)
      .filter(Boolean)
      .map((path) => "A\t" + path)
  ].filter(Boolean);
  const changesByPath = new Map();
  for (const line of rows) {
    const [status, ...paths] = line.split("\t");
    changesByPath.set(paths.join("\0"), { status: status[0], paths });
  }
  return [...changesByPath.values()];
}

function publicPackages() {
  return readdirSync("packages", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directory = `packages/${entry.name}`;
      const manifestPath = resolve(directory, "package.json");
      if (!existsSync(manifestPath)) return null;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      return manifest.private === false ? { directory, name: manifest.name } : null;
    })
    .filter(Boolean);
}

function branchName() {
  return process.env.GITHUB_HEAD_REF?.trim() || git(["branch", "--show-current"]).trim();
}

function isReleaseArtifact(path, packageDirectory) {
  const relative = path.slice(`${packageDirectory}/`.length);
  return relative === "package.json" || relative === "CHANGELOG.md";
}

function run() {
  if (process.argv.includes("--validate-pending")) {
    const packages = publicPackages();
    const names = new Set(packages.map(({ name }) => name));
    const pending = readdirSync(".changeset")
      .filter((file) => file.endsWith(".md") && file !== "README.md")
      .map((file) => ".changeset/" + file);
    for (const notePath of pending) {
      const parsed = parseChangeset(readFileSync(resolve(notePath), "utf8"), names);
      if (parsed.error) throw new Error("Invalid pending changeset " + notePath + ": " + parsed.error + ".");
    }
    const output = process.env.GITHUB_OUTPUT;
    if (output) appendFileSync(output, "release_needed=" + String(pending.length > 0) + "\n");
    if (pending.length === 0) {
      console.log("No pending changesets; package release is not needed.");
      return;
    }
    console.log("Validated " + pending.length + " pending changeset(s) before dependency installation.");
    return;
  }

  const base = resolveBase();
  const files = changedFiles(base.ref);
  const packages = publicPackages();
  const packageByDirectory = new Map(packages.map((pkg) => [pkg.directory, pkg]));
  const affected = new Map();
  for (const change of files) {
    for (const path of change.paths) {
      const pkg = packages.find(({ directory }) => path.startsWith(`${directory}/`));
      if (pkg) {
        if (!affected.has(pkg.directory)) affected.set(pkg.directory, []);
        affected.get(pkg.directory).push(path);
      }
    }
  }

  // The main promotion has its own stricter checker. Per-PR changeset coverage
  // is validated on feature PRs; reinterpreting the full release diff here can
  // mistake a promotion for a feature branch.
  if (base.name === "main" || base.ref === "origin/main") {
    console.log(
      `Changeset coverage delegated to promotion readiness check (base ${base.ref}, ${files.length} changed paths).`
    );
    return;
  }

  const releaseBranch = branchName() === "changeset-release/develop";
  const noteChanges = files.filter(({ paths }) => paths.some((path) => notePattern.test(path)));
  const addedNotes = noteChanges.filter(({ status }) => status === "A");
  const removedNotes = noteChanges.filter(({ status }) => status === "D");
  const modifiedNotes = noteChanges.filter(({ status }) => status !== "A" && status !== "D");

  if (modifiedNotes.length) {
    throw new Error(
      `Changeset notes are immutable; create a new note instead of modifying: ${modifiedNotes.flatMap(({ paths }) => paths).join(", ")}`
    );
  }

  if (releaseBranch) {
    if (addedNotes.length)
      throw new Error(
        "A Changesets release PR cannot add new notes; regenerate it from the current develop head."
      );
    if (removedNotes.length === 0)
      throw new Error(
        "The changeset-release/develop branch must consume at least one existing Changeset."
      );
    if (affected.size === 0)
      throw new Error(
        "The Changesets release PR consumed notes but did not change any public package."
      );
    const invalidChanges = [];
    for (const [directory, paths] of affected) {
      if (paths.some((path) => !isReleaseArtifact(path, directory)))
        invalidChanges.push(...paths.filter((path) => !isReleaseArtifact(path, directory)));
    }
    if (invalidChanges.length)
      throw new Error(
        `Release PR contains non-generated package files: ${invalidChanges.join(", ")}`
      );
    for (const { paths } of removedNotes) {
      const notePath = paths.at(-1);
      const source = git(["show", `${base.ref}:${notePath}`]);
      const parsed = parseChangeset(source, new Set(packages.map(({ name }) => name)));
      if (parsed.error)
        throw new Error(`Consumed changeset ${notePath} was invalid at base: ${parsed.error}`);
    }
    for (const pkg of packages) {
      if (!affected.has(pkg.directory)) continue;
      if (!affected.get(pkg.directory).includes(`${pkg.directory}/package.json`)) {
        throw new Error(
          `Release PR changes ${pkg.name} without updating its package.json version.`
        );
      }
      const previous = JSON.parse(git(["show", `${base.ref}:${pkg.directory}/package.json`]));
      const current = JSON.parse(readFileSync(resolve(pkg.directory, "package.json"), "utf8"));
      if (!previous.version || !current.version || previous.version === current.version) {
        throw new Error(
          `Release PR did not change the version for ${pkg.name} (${previous.version ?? "unknown"} -> ${current.version ?? "unknown"}).`
        );
      }
    }
    console.log(
      `Validated generated Changesets release: ${removedNotes.length} consumed note(s), ${affected.size} public package(s), base ${base.ref}.`
    );
    return;
  }

  if (removedNotes.length) {
    throw new Error(
      `Only the Changesets release PR may consume notes; removed: ${removedNotes.flatMap(({ paths }) => paths).join(", ")}`
    );
  }

  const publicNames = new Set(packages.map(({ name }) => name));
  const coverage = new Set();
  for (const { paths } of addedNotes) {
    const notePath = paths.at(-1);
    const parsed = parseChangeset(readFileSync(resolve(notePath), "utf8"), publicNames);
    if (parsed.error) throw new Error(`Invalid changeset ${notePath}: ${parsed.error}.`);
    for (const packageName of parsed.entries.keys()) coverage.add(packageName);
  }

  const missing = [...affected].flatMap(([packageDirectory]) => {
    const pkg = packageByDirectory.get(packageDirectory);
    return pkg && !coverage.has(pkg.name) ? [`${pkg.name} (${packageDirectory})`] : [];
  });
  if (missing.length) {
    throw new Error(
      `Every changed public package needs a new, valid changeset covering it. Missing: ${[...new Set(missing)].join(", ")}.`
    );
  }

  console.log(
    `Changeset validation passed against ${base.ref}: ${affected.size} affected public package(s), ${addedNotes.length} new note(s), including local working-tree changes.`
  );
}

try {
  run();
} catch (error) {
  console.error(`::error::${error.message}`);
  process.exitCode = 1;
}
