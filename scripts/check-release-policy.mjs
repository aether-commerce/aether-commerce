import { execFileSync } from "node:child_process";

const base = process.env.GITHUB_BASE_REF?.trim();
const head = process.env.GITHUB_HEAD_REF?.trim();
const event = process.env.GITHUB_EVENT_NAME?.trim();
const gitExecutable =
  process.platform === "win32" ? "C:\\Program Files\\Git\\cmd\\git.exe" : "/usr/bin/git";
const violations = [];

if (event === "pull_request" && (!base || !head)) {
  violations.push("Pull request policy requires both GITHUB_BASE_REF and GITHUB_HEAD_REF.");
}

if (base === "main" && head !== "develop") {
  violations.push(
    "Promotions to main must use develop as the head branch; received " +
      (head || "an unknown head branch") +
      "."
  );
}

if (head === "automation/aether-release-main") {
  violations.push(
    "The main release PR path is disabled. Prepare the Changesets release on develop, then promote develop to main."
  );
}

let commitMessages = "";
try {
  const args =
    event === "pull_request" && base
      ? ["log", "--format=%B", "origin/" + base + "..HEAD"]
      : ["show", "-s", "--format=%B", "HEAD"];
  commitMessages = execFileSync(gitExecutable, args, { encoding: "utf8" });
} catch (error) {
  violations.push(
    "Unable to inspect commit messages" +
      (base ? " against origin/" + base : "") +
      ": " +
      error.message
  );
}

if (/\[(?:skip ci|ci skip)\]/i.test(commitMessages)) {
  violations.push("Release and promotion commits must not contain [skip ci] or [ci skip].");
}

if (violations.length > 0) {
  for (const violation of violations) console.error("::error::" + violation);
  process.exitCode = 1;
} else if (event === "pull_request") {
  console.log("Release policy OK: " + head + " -> " + base + ".");
} else {
  console.log(
    "Release policy OK for " + (event || "local") + " event; inspected the current commit."
  );
}
