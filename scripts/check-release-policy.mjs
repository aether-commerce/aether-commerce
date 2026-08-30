import { execFileSync } from "node:child_process";

const base = process.env.GITHUB_BASE_REF?.trim();
const head = process.env.GITHUB_HEAD_REF?.trim();

if (!base) {
  console.log("Release policy enforcement only applies to pull requests.");
  process.exit(0);
}

const violations = [];

if (base === "main" && head !== "develop") {
  violations.push(
    `Promotions to main must use develop as the head branch; received ${head || "an unknown head branch"}.`
  );
}

if (head === "automation/aether-release-main") {
  violations.push(
    "The main release PR path is disabled. Prepare the Changesets release on develop, then promote develop to main."
  );
}

const gitExecutable = process.platform === "win32" ? "C:\\Program Files\\Git\\cmd\\git.exe" : "/usr/bin/git";
let commitMessages = "";
try {
  commitMessages = execFileSync(gitExecutable, ["log", "--format=%B", `origin/${base}..HEAD`], {
    encoding: "utf8"
  });
} catch (error) {
  violations.push(`Unable to inspect commits against origin/${base}: ${error.message}`);
}

if (/\[(?:skip ci|ci skip)\]/i.test(commitMessages)) {
  violations.push("Release and promotion commits must not contain [skip ci] or [ci skip].");
}

if (violations.length > 0) {
  for (const violation of violations) console.error(`::error::${violation}`);
  process.exit(1);
}

console.log(`Release policy OK: ${head || "current branch"} -> ${base}.`);
