import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const gitExecutable =
  process.platform === "win32" ? "C:\\Program Files\\Git\\cmd\\git.exe" : "/usr/bin/git";

export function deploymentAuthorizationErrors(context) {
  const errors = [];
  const shaPattern = /^[0-9a-f]{40}$/i;
  const allowedBranches = new Set(["main", "develop"]);

  if (!allowedBranches.has(context.targetBranch))
    errors.push("target branch must be main or develop");
  if (!context.repository || !/^[^/]+\/[^/]+$/.test(context.repository))
    errors.push("target repository identity is missing or invalid");
  if (!shaPattern.test(context.expectedSha ?? ""))
    errors.push("expected source SHA must be a full 40-character commit");

  if (context.eventName === "workflow_run") {
    if (context.workflowName !== "Aether CI") errors.push("upstream workflow must be Aether CI");
    if (context.upstreamEvent !== "push")
      errors.push("only a push CI run may authorize deployment");
    if (context.upstreamConclusion !== "success")
      errors.push("upstream CI must conclude successfully");
    if (context.upstreamRepository !== context.repository)
      errors.push("upstream repository does not match the deployment repository");
    if (context.upstreamBranch !== context.targetBranch)
      errors.push("upstream branch does not match the deployment target");
    if (context.upstreamSha !== context.expectedSha)
      errors.push("upstream CI SHA does not match the requested deployment SHA");
  } else if (context.eventName === "workflow_dispatch") {
    if (context.githubRef !== "refs/heads/" + context.targetBranch)
      errors.push("manual deployment must target the configured branch");
  } else {
    errors.push("deployment is authorized only for workflow_run or workflow_dispatch");
  }

  if (!shaPattern.test(context.currentBranchSha ?? ""))
    errors.push("current remote branch tip could not be verified");
  else if (context.currentBranchSha !== context.expectedSha)
    errors.push("requested deployment SHA is stale; the target branch has advanced");
  if (context.currentCheckoutSha !== context.expectedSha)
    errors.push("checked out source SHA does not match the requested deployment SHA");
  return errors;
}

export function hasSuccessfulCiRun(context, runs) {
  return (
    Array.isArray(runs) &&
    runs.some(
      (run) =>
        run.name === "Aether CI" &&
        run.event === "push" &&
        run.conclusion === "success" &&
        run.head_branch === context.targetBranch &&
        run.head_sha === context.expectedSha
    )
  );
}

async function verifyManualDispatchCi(context) {
  const token = process.env.GH_TOKEN;
  if (!token)
    throw new Error("GH_TOKEN is required to verify successful CI for a manual deployment.");
  const query = new URLSearchParams({
    branch: context.targetBranch,
    event: "push",
    status: "completed",
    per_page: "100"
  });
  const url =
    "https://api.github.com/repos/" +
    context.repository +
    "/actions/workflows/ci.yml/runs?" +
    query.toString();
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: "Bearer " + token,
      "x-github-api-version": "2022-11-28"
    }
  });
  if (!response.ok)
    throw new Error(
      "GitHub did not confirm CI history for the manual deployment (HTTP " + response.status + ")."
    );
  const data = await response.json();
  if (!hasSuccessfulCiRun(context, data.workflow_runs)) {
    throw new Error("No successful Aether CI push run exists for the exact manual deployment SHA.");
  }
}

async function run() {
  const targetBranch = process.env.DEPLOY_TARGET_BRANCH || "";
  const expectedSha = process.env.EXPECTED_RELEASE_SHA || "";
  let currentBranchSha = "";
  let currentCheckoutSha = "";
  try {
    const output = execFileSync(
      gitExecutable,
      ["ls-remote", "origin", "refs/heads/" + targetBranch],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    ).trim();
    currentBranchSha = output.split(/\s+/)[0] || "";
    currentCheckoutSha = execFileSync(gitExecutable, ["rev-parse", "HEAD"], {
      encoding: "utf8"
    }).trim();
  } catch (error) {
    console.error("::error::Unable to read the current remote branch tip: " + error.message);
  }

  const context = {
    eventName: process.env.GITHUB_EVENT_NAME || "",
    githubRef: process.env.GITHUB_REF || "",
    repository: process.env.GITHUB_REPOSITORY || "",
    targetBranch,
    expectedSha,
    workflowName: process.env.UPSTREAM_WORKFLOW_NAME || "",
    upstreamEvent: process.env.UPSTREAM_EVENT || "",
    upstreamConclusion: process.env.UPSTREAM_CONCLUSION || "",
    upstreamRepository: process.env.UPSTREAM_REPOSITORY || "",
    upstreamBranch: process.env.UPSTREAM_BRANCH || "",
    upstreamSha: process.env.UPSTREAM_SHA || "",
    currentBranchSha,
    currentCheckoutSha
  };
  const errors = deploymentAuthorizationErrors(context);
  if (errors.length) {
    for (const error of errors)
      console.error("::error::Deployment authorization failed: " + error + ".");
    process.exitCode = 1;
    return;
  }
  if (context.eventName === "workflow_dispatch") {
    try {
      await verifyManualDispatchCi(context);
    } catch (error) {
      console.error("::error::Deployment authorization failed: " + error.message);
      process.exitCode = 1;
      return;
    }
  }
  console.log(
    "Deployment authorized for " +
      context.repository +
      " " +
      context.targetBranch +
      " at " +
      context.expectedSha +
      "."
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
