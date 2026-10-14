import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/i;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function hasSuccessfulPushCiRun(sha, runs) {
  return (
    Array.isArray(runs) &&
    runs.some(
      (run) =>
        run.name === "Aether CI" &&
        run.event === "push" &&
        run.conclusion === "success" &&
        run.head_branch === "main" &&
        run.head_sha === sha
    )
  );
}

export function packageReleaseResumeErrors(context) {
  const errors = [];
  if (context.eventName !== "workflow_dispatch") errors.push("release resume requires workflow_dispatch");
  if (context.githubRef !== "refs/heads/main") errors.push("release resume must target main");
  if (!/^[^/]+\/[^/]+$/.test(context.repository ?? "")) errors.push("repository identity is missing or invalid");
  if (!SHA_PATTERN.test(context.releaseSha ?? "")) errors.push("resume release SHA must be a full commit SHA");
  if (!SHA_PATTERN.test(context.currentMainSha ?? "")) errors.push("current main SHA could not be verified");
  if (!SHA_PATTERN.test(context.remoteMainSha ?? "")) errors.push("remote main SHA could not be verified");
  if (context.currentMainSha !== context.remoteMainSha) errors.push("main advanced after the manual resume was requested");
  if (context.currentCheckoutSha !== context.currentMainSha) errors.push("checkout does not match the current main SHA");
  if (context.releaseIsAncestor !== true) errors.push("resume release SHA is not an ancestor of current main");
  if (context.buildInputsUnchanged !== true) errors.push("package source or build inputs changed after the release SHA");
  if (context.releaseCiVerified !== true) errors.push("no successful Aether CI push run exists for the release SHA");
  if (context.currentMainCiVerified !== true) errors.push("no successful Aether CI push run exists for current main");
  return errors;
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: "Bearer " + token,
      "x-github-api-version": "2022-11-28"
    }
  });
  if (!response.ok) throw new Error("GitHub could not verify package release resume authorization (HTTP " + response.status + ").");
  return response.json();
}

async function successfulCi(repository, sha, token) {
  const query = new URLSearchParams({
    branch: "main",
    event: "push",
    head_sha: sha,
    status: "completed",
    per_page: "100"
  });
  const url = "https://api.github.com/repos/" + repository + "/actions/workflows/ci.yml/runs?" + query.toString();
  const data = await fetchJson(url, token);
  return hasSuccessfulPushCiRun(sha, data.workflow_runs);
}

async function run() {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GH_TOKEN is required to resume a package release.");
  const repository = process.env.GITHUB_REPOSITORY || "";
  const releaseSha = process.env.RELEASE_SHA || "";
  const currentMainSha = process.env.GITHUB_SHA || "";
  const currentCheckoutSha = git(["rev-parse", "HEAD"]);
  const remoteOutput = git(["ls-remote", "origin", "refs/heads/main"]);
  const remoteMainSha = remoteOutput.split(/\s+/)[0] || "";
  let releaseIsAncestor = false;
  let buildInputsUnchanged = false;

  if (SHA_PATTERN.test(releaseSha) && SHA_PATTERN.test(currentMainSha)) {
    const compareUrl =
      "https://api.github.com/repos/" + repository + "/compare/" + releaseSha + "..." + currentMainSha;
    const compare = await fetchJson(compareUrl, token);
    releaseIsAncestor = compare.status === "ahead" || compare.status === "identical";

    const changedInputs = git([
      "diff",
      "--name-only",
      releaseSha,
      currentMainSha,
      "--",
      "packages",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "turbo.json",
      "tsconfig.json",
      "tsconfig.base.json"
    ]);
    buildInputsUnchanged = changedInputs.length === 0;
  }

  const [releaseCiVerified, currentMainCiVerified] = await Promise.all([
    successfulCi(repository, releaseSha, token),
    successfulCi(repository, currentMainSha, token)
  ]);
  const context = {
    eventName: process.env.GITHUB_EVENT_NAME || "",
    githubRef: process.env.GITHUB_REF || "",
    repository,
    releaseSha,
    currentMainSha,
    remoteMainSha,
    currentCheckoutSha,
    releaseIsAncestor,
    buildInputsUnchanged,
    releaseCiVerified,
    currentMainCiVerified
  };
  const errors = packageReleaseResumeErrors(context);
  if (errors.length) {
    for (const error of errors) console.error("::error::Package release resume authorization failed: " + error + ".");
    process.exitCode = 1;
    return;
  }
  console.log("Package release resume authorized for " + repository + " at " + releaseSha + ".");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run();
  } catch (error) {
    console.error("::error::Package release resume authorization failed: " + error.message);
    process.exitCode = 1;
  }
}
