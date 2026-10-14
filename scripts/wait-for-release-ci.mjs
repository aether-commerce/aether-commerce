import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function matchingCiRuns(runs, source) {
  return runs
    .filter(
      (run) =>
        run.name === "Aether CI" &&
        run.path === ".github/workflows/ci.yml" &&
        run.event === "push" &&
        run.head_branch === source.branch &&
        run.head_sha === source.sha
    )
    .sort((left, right) => {
      const attemptDifference = (right.run_attempt ?? 0) - (left.run_attempt ?? 0);
      return (
        attemptDifference ||
        String(right.created_at ?? "").localeCompare(String(left.created_at ?? ""))
      );
    });
}

export function ciStatus(runs, source) {
  const run = matchingCiRuns(runs, source)[0];
  if (!run || run.status !== "completed") return { state: "pending", run };
  if (run.conclusion === "success") return { state: "success", run };
  return { state: "failure", run };
}

async function waitForCi() {
  const source = {
    repository: process.env.GITHUB_REPOSITORY,
    branch: "develop",
    sha: process.env.RELEASE_SOURCE_SHA
  };
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GH_TOKEN is required to verify the push CI run.");
  if (!/^[a-f0-9]{40}$/i.test(source.sha ?? ""))
    throw new Error("RELEASE_SOURCE_SHA must be a full commit SHA.");
  if (process.env.GITHUB_REF_NAME !== source.branch)
    throw new Error("The package release may run only for a develop push.");

  const currentDevelop = process.env.CURRENT_DEVELOP_SHA;
  if (currentDevelop !== source.sha)
    throw new Error(
      "Release source is stale: develop is " + currentDevelop + ", event SHA is " + source.sha + "."
    );

  const endpoint =
    "https://api.github.com/repos/" +
    source.repository +
    "/actions/workflows/ci.yml/runs?branch=develop&event=push&per_page=100";
  const maxAttempts = Number.parseInt(process.env.CI_WAIT_MAX_ATTEMPTS ?? "80", 10);
  const intervalMs = Number.parseInt(process.env.CI_WAIT_INTERVAL_MS ?? "15000", 10);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    if (!response.ok) throw new Error("GitHub Actions API returned HTTP " + response.status + ".");
    const { workflow_runs: runs = [] } = await response.json();
    const status = ciStatus(runs, source);
    if (status.state === "success") {
      console.log("Validated Aether CI run " + status.run.html_url + " for " + source.sha + ".");
      return;
    }
    if (status.state === "failure") {
      throw new Error(
        "Aether CI run " + status.run.html_url + " for " + source.sha + " concluded " + status.run.conclusion + "."
      );
    }
    console.log("Waiting for Aether CI on " + source.sha + " (" + attempt + "/" + maxAttempts + ").");
    if (attempt < maxAttempts) await new Promise((done) => setTimeout(done, intervalMs));
  }
  throw new Error("Aether CI did not complete successfully for " + source.sha + " before the timeout.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  waitForCi().catch((error) => {
    console.error("::error::" + error.message);
    process.exitCode = 1;
  });
}
