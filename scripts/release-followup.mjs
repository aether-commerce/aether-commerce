import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const shaPattern = /^[0-9a-f]{40}$/i;

async function github(repository, endpoint, options = {}) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    try {
      const args = ["api", `repos/${repository}/${endpoint}`];
      if (options.method) args.push("--method", options.method);
      if (options.body) args.push("--input", "-");
      const result = execFileSync("gh", args, {
        encoding: "utf8",
        input: options.body,
        stdio: [options.body ? "pipe" : "ignore", "pipe", "pipe"]
      }).trim();
      return result ? JSON.parse(result) : null;
    } catch (error) {
      if (options.allow404 && /HTTP 404/.test(String(error.stderr ?? ""))) return null;
      throw new Error(
        `GitHub ${repository}/${endpoint}: ${String(error.stderr ?? error.message).trim()}`
      );
    }
  }
  const response = await fetch(`https://api.github.com/repos/${repository}/${endpoint}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(options.body ? { "content-type": "application/json" } : {})
    }
  });
  if (response.status === 404 && options.allow404) return null;
  if (!response.ok) throw new Error(`GitHub ${repository}/${endpoint}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function latestRun(
  repository,
  workflow,
  sha,
  events = ["workflow_run", "workflow_dispatch"]
) {
  const data = await github(
    repository,
    `actions/workflows/${workflow}/runs?head_sha=${sha}&per_page=100`
  );
  return (
    (data.workflow_runs ?? [])
      .filter(
        (run) => run.head_sha === sha && run.head_branch === "main" && events.includes(run.event)
      )
      .sort(
        (a, b) =>
          new Date(b.run_started_at ?? b.created_at) - new Date(a.run_started_at ?? a.created_at)
      )[0] ?? null
  );
}

export function runPhase(run, label) {
  if (!run) return { status: "missing", reason: `No ${label} run for the exact SHA.` };
  if (run.status !== "completed")
    return { status: "pending", url: run.html_url, reason: `${label} is ${run.status}.` };
  return {
    status: run.conclusion === "success" ? "success" : "failed",
    url: run.html_url,
    reason: `${label} concluded ${run.conclusion}.`
  };
}

export function decideResume(verification) {
  const { phases } = verification;
  if (phases.ci.status !== "success")
    return { action: "block", reason: "Exact main push CI must pass first." };
  if (phases.deployment.status === "pending" || phases.publication.status === "pending")
    return { action: "wait", reason: "A release workflow is still running." };
  if (["failed", "missing"].includes(phases.deployment.status))
    return {
      action: "dispatch",
      workflow: "deploy-production.yml",
      reason: "Retry the production deploy for the current main SHA."
    };
  if (["failed", "missing"].includes(phases.publication.status)) {
    if (phases.manifest.status !== "success")
      return {
        action: "block",
        reason:
          "Package publication is incomplete; the resume workflow only verifies already published packages."
      };
    return {
      action: "dispatch",
      workflow: "publish-packages.yml",
      inputs: { resume_release_sha: verification.releaseSha },
      reason: "Retry manifest and client delivery without republishing packages."
    };
  }
  if (phases.manifest.status === "missing")
    return {
      action: "block",
      reason:
        "The immutable package manifest is missing; verify package registry and tags before resuming."
    };
  if (phases.history.status === "missing")
    return {
      action: "dispatch",
      workflow: "sync-main-history.yml",
      reason: "Create the missing main-to-develop history PR."
    };
  if (phases.history.status === "pending")
    return { action: "wait", reason: "The history PR must pass its current-head CI and merge." };
  if (phases.client.status === "pending" || phases.client.status === "unknown")
    return {
      action: "wait",
      reason: "The Liminal update needs its own PR, promotion, CI and deploy evidence."
    };
  if (phases.client.status === "failed")
    return {
      action: "block",
      reason: "Liminal CI or deploy failed; inspect its run before replaying the manifest."
    };
  return { action: "done", reason: "All applicable release stages are verified." };
}

async function clientPhase(releaseSha) {
  const repository = process.env.AETHER_CLIENT_REPOSITORY || "aether-commerce/liminal-store";
  try {
    const [pulls, main] = await Promise.all([
      github(repository, "pulls?state=closed&base=development&per_page=100"),
      github(repository, "branches/main")
    ]);
    const update = pulls.find((pr) => pr.merged_at && (pr.body ?? "").includes(releaseSha));
    if (!update)
      return {
        status: "pending",
        reason: "No merged Liminal update PR references this Aether release SHA."
      };
    const comparison = await github(
      repository,
      `compare/${update.merge_commit_sha}...${main.commit.sha}`
    );
    if (!["identical", "ahead"].includes(comparison.status))
      return {
        status: "pending",
        url: update.html_url,
        reason: "The Liminal update has not reached main."
      };
    const [ci, deploy] = await Promise.all([
      latestRun(repository, "ci.yml", main.commit.sha, ["push"]),
      latestRun(repository, "deploy.yml", main.commit.sha)
    ]);
    const ciPhase = runPhase(ci, "Liminal CI");
    const deployPhase = runPhase(deploy, "Liminal deploy");
    if (ciPhase.status !== "success" || deployPhase.status !== "success")
      return {
        status:
          ciPhase.status === "failed" || deployPhase.status === "failed" ? "failed" : "pending",
        url: update.html_url,
        reason: `${ciPhase.reason} ${deployPhase.reason}`
      };
    return {
      status: "success",
      url: update.html_url,
      reason: `Liminal main ${main.commit.sha} contains the update and passed CI/deploy.`
    };
  } catch (error) {
    return { status: "unknown", reason: `Could not verify Liminal delivery: ${error.message}` };
  }
}

export async function verifyRelease(repository, releaseSha) {
  if (!shaPattern.test(releaseSha)) throw new Error("A full 40-character release SHA is required.");
  const [main, develop, ciRun, deploymentRun, publicationRun] = await Promise.all([
    github(repository, "branches/main"),
    github(repository, "branches/develop"),
    latestRun(repository, "ci.yml", releaseSha, ["push"]),
    latestRun(repository, "deploy-production.yml", releaseSha),
    latestRun(repository, "publish-packages.yml", releaseSha)
  ]);
  if (main.commit.sha !== releaseSha)
    throw new Error(
      `Release SHA is stale: main is ${main.commit.sha}. Verify a historical release separately.`
    );
  git("fetch", "origin", "main", "develop");
  if (
    git("rev-parse", "origin/main") !== releaseSha ||
    git("rev-parse", "origin/develop") !== develop.commit.sha
  )
    throw new Error("Local remote refs changed during verification; retry with a fresh snapshot.");
  const changed = git("diff", "--name-only", `${releaseSha}^`, releaseSha, "--", "packages")
    .split(/\r?\n/)
    .filter(Boolean);
  const packageRelease = changed.some((path) => /^packages\/[^/]+\/package\.json$/.test(path));
  const historyContained = gitAncestor(releaseSha, develop.commit.sha);
  const historyPrs = historyContained
    ? []
    : await github(
        repository,
        "pulls?state=open&base=develop&head=chore/sync-main-to-develop&per_page=10"
      );
  const release = packageRelease
    ? await github(repository, `releases/tags/aether-release-${releaseSha}`, { allow404: true })
    : null;
  const manifestExists =
    release?.assets?.some((asset) => asset.name === "release-manifest.v1.json") ?? false;
  const phases = {
    ci: runPhase(ciRun, "Aether main push CI"),
    deployment: runPhase(deploymentRun, "Aether production deploy"),
    publication: packageRelease
      ? runPhase(publicationRun, "Aether package publish")
      : { status: "not_applicable", reason: "No package version changed in this release." },
    manifest: packageRelease
      ? {
          status: manifestExists ? "success" : "missing",
          reason: manifestExists
            ? "Immutable manifest asset exists."
            : "Immutable manifest asset is missing."
        }
      : { status: "not_applicable", reason: "No package release." },
    client: packageRelease
      ? await clientPhase(releaseSha)
      : { status: "not_applicable", reason: "No package release requires a client update." },
    history: historyContained
      ? { status: "success", reason: "develop contains the production commit." }
      : historyPrs.length
        ? { status: "pending", url: historyPrs[0].html_url, reason: "The main history PR is open." }
        : { status: "missing", reason: "The main history PR has not been created." }
  };
  const statuses = Object.values(phases).map((phase) => phase.status);
  const overall = statuses.includes("failed")
    ? "failed"
    : statuses.includes("unknown")
      ? "unknown"
      : statuses.some((state) => state === "pending" || state === "missing")
        ? "incomplete"
        : "complete";
  const planId = createHash("sha256")
    .update(`${repository}:${releaseSha}:${develop.commit.sha}:${JSON.stringify(phases)}`)
    .digest("hex")
    .slice(0, 20);
  const result = {
    schemaVersion: 1,
    releaseSha,
    repository,
    developSha: develop.commit.sha,
    planId,
    overall,
    phases
  };
  result.nextAction = decideResume(result);
  return result;
}

function gitAncestor(ancestor, descendant) {
  try {
    git("merge-base", "--is-ancestor", ancestor, descendant);
    return true;
  } catch {
    return false;
  }
}

export async function resumeRelease(verification, suppliedPlanId) {
  if (verification.planId !== suppliedPlanId)
    throw new Error("Plan ID is stale; run release:verify again.");
  const fresh = await verifyRelease(verification.repository, verification.releaseSha);
  if (fresh.planId !== suppliedPlanId)
    throw new Error("Release state changed; run release:verify again before resuming.");
  const action = decideResume(fresh);
  if (action.action !== "dispatch") return { ...action, dispatched: false };
  await github(fresh.repository, `actions/workflows/${action.workflow}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs: action.inputs ?? {} })
  });
  return { ...action, dispatched: true, releaseSha: fresh.releaseSha };
}
