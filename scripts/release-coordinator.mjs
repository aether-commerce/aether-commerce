import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_CHECK = "Aether CI / validate";
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const gitExecutable = process.platform === "win32" ? "C:\\Program Files\\Git\\cmd\\git.exe" : "git";

function git(args) {
  return execFileSync(gitExecutable, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 4 * 1024 * 1024
  }).trim();
}

function maybeGit(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function repositorySlug() {
  const configured = process.env.GITHUB_REPOSITORY?.trim();
  if (configured && repositoryPattern.test(configured)) return configured;

  const remote = maybeGit(["remote", "get-url", "origin"]);
  if (!remote) return null;
  const match = remote.match(
    /^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/i
  );
  return match?.[1] ?? null;
}

function remoteSha(branch) {
  return maybeGit(["rev-parse", "--verify", `refs/remotes/origin/${branch}^{commit}`]);
}

function publicPackages() {
  if (!existsSync("packages")) return [];
  return readdirSync("packages", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directory = `packages/${entry.name}`;
      const manifestPath = resolve(directory, "package.json");
      if (!existsSync(manifestPath)) return null;
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        return manifest.private === false ? { directory, name: manifest.name } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function readLocalStatus() {
  const branch = maybeGit(["branch", "--show-current"]);
  const headSha = maybeGit(["rev-parse", "HEAD"]);
  const dirtyEntries = (maybeGit(["status", "--porcelain=v1", "--untracked-files=all"]) ?? "")
    .split(/\r?\n/)
    .filter(Boolean);
  const refs = { develop: remoteSha("develop"), main: remoteSha("main") };
  const integrationCounts =
    refs.develop && headSha
      ? maybeGit(["rev-list", "--left-right", "--count", `origin/develop...${headSha}`])
      : null;
  const promotionCounts =
    refs.develop && refs.main
      ? maybeGit(["rev-list", "--left-right", "--count", "origin/main...origin/develop"])
      : null;
  const changedPaths =
    refs.develop && refs.main
      ? (maybeGit(["diff", "--name-only", "origin/main...origin/develop"]) ?? "")
          .split(/\r?\n/)
          .filter(Boolean)
      : [];
  const packages = publicPackages();
  const changedPublicPackages = packages
    .filter(({ directory }) => changedPaths.some((path) => path.startsWith(`${directory}/`)))
    .map(({ name, directory }) => ({ name, directory }));
  const pendingChangesets = existsSync(".changeset")
    ? readdirSync(".changeset").filter((name) => name.endsWith(".md") && name !== "README.md")
    : [];

  const parseCounts = (value) => {
    if (!value) return null;
    const [behind, ahead] = value.split(/\s+/).map(Number);
    return Number.isFinite(behind) && Number.isFinite(ahead) ? { behind, ahead } : null;
  };

  return {
    branch,
    headSha,
    clean: dirtyEntries.length === 0,
    dirtyCount: dirtyEntries.length,
    refs,
    currentVsDevelop: parseCounts(integrationCounts),
    developVsMain: parseCounts(promotionCounts),
    mainIsAncestorOfDevelop:
      refs.main && refs.develop
        ? maybeGit(["merge-base", "--is-ancestor", "origin/main", "origin/develop"]) !== null
        : null,
    integrationDiff: {
      available: Boolean(refs.main && refs.develop),
      changedFileCount: changedPaths.length,
      changedPublicPackages,
      changedClientTemplate:
        changedPaths.some(
          (path) =>
            path.startsWith("packages/client-template/") ||
            path.startsWith("packages/client-template-")
        ) || changedPublicPackages.some(({ name }) => name?.includes("client-template")),
      pendingChangesets
    }
  };
}

async function requestGitHub(repository, endpoint) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token) {
    const response = await fetch(`https://api.github.com/repos/${repository}/${endpoint}`, {
      method: "GET",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28"
      }
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
    return response.json();
  }

  try {
    const result = execFileSync("gh", ["api", `repos/${repository}/${endpoint}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 4 * 1024 * 1024
    });
    return JSON.parse(result);
  } catch {
    throw new Error("GitHub CLI is not authenticated and GH_TOKEN/GITHUB_TOKEN is unset");
  }
}

async function settledRequest(repository, endpoint) {
  try {
    return { value: await requestGitHub(repository, endpoint) };
  } catch (error) {
    return { error: error.message };
  }
}

function branchProtection(branch) {
  const required = branch?.protection?.required_status_checks;
  const check = required?.checks?.find((entry) => entry.context === REQUIRED_CHECK);
  const contextExists = required?.contexts?.includes(REQUIRED_CHECK) ?? false;
  return {
    protected: branch?.protected === true,
    requiredCheckConfigured: Boolean(check || contextExists),
    requiredCheckAppIdKnown: Number.isInteger(check?.app_id),
    appId: check?.app_id ?? null
  };
}

function summarizePullRequest(pr) {
  return {
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
    headRef: pr.head?.ref ?? null,
    headSha: pr.head?.sha ?? null,
    baseRef: pr.base?.ref ?? null,
    draft: pr.draft === true,
    updatedAt: pr.updated_at ?? null
  };
}

async function readGitHubStatus(repository, local) {
  if (!repository)
    return { state: "unavailable", reason: "GitHub repository could not be inferred from origin." };

  const query = "state=open&per_page=100";
  const endpoints = {
    develop: `branches/develop`,
    main: `branches/main`,
    workPullRequests: `pulls?${query}&base=develop`,
    promotionPullRequests: `pulls?${query}&base=main`
  };
  const entries = await Promise.all(
    Object.entries(endpoints).map(async ([key, endpoint]) => [
      key,
      await settledRequest(repository, endpoint)
    ])
  );
  const results = Object.fromEntries(entries);
  const remoteDevelopSha = results.develop.value?.commit?.sha ?? local.refs.develop;
  const promotionPrs = results.promotionPullRequests.value;
  const openPromotion = Array.isArray(promotionPrs)
    ? promotionPrs.find((pr) => pr.head?.ref === "develop" && pr.base?.ref === "main")
    : null;
  const checkTargets = {
    develop: remoteDevelopSha,
    promotion: openPromotion?.head?.sha ?? null
  };
  const checks = await Promise.all(
    Object.entries(checkTargets).map(async ([key, sha]) => {
      if (!sha) return [key, { state: "unavailable", sha: null, required: null }];
      const result = await settledRequest(repository, `commits/${sha}/check-runs?per_page=100`);
      const checkRuns = result.value?.check_runs ?? [];
      const required = selectRequiredCheck(checkRuns, sha);
      return [
        key,
        {
          state: result.error ? "unavailable" : required.state,
          sha,
          required,
          ...(result.error ? { reason: result.error } : {})
        }
      ];
    })
  );

  const failed = Object.values(results).filter((entry) => entry.error);
  const checkFailures = checks.map(([, value]) => value).filter((value) => value.reason);
  const unavailableCount = failed.length + checkFailures.length;
  const state =
    unavailableCount === 0
      ? "available"
      : unavailableCount < Object.keys(endpoints).length + checks.length
        ? "partial"
        : "unavailable";

  return {
    state,
    ...(unavailableCount
      ? {
          reason:
            "Some GitHub read requests failed; verify repository read permissions and authentication."
        }
      : {}),
    branches: {
      develop: results.develop.value
        ? {
            sha: results.develop.value.commit?.sha ?? null,
            protection: branchProtection(results.develop.value)
          }
        : {
            sha: local.refs.develop,
            protection: {
              protected: null,
              requiredCheckConfigured: null,
              requiredCheckAppIdKnown: null,
              appId: null
            }
          },
      main: results.main.value
        ? {
            sha: results.main.value.commit?.sha ?? null,
            protection: branchProtection(results.main.value)
          }
        : {
            sha: local.refs.main,
            protection: {
              protected: null,
              requiredCheckConfigured: null,
              requiredCheckAppIdKnown: null,
              appId: null
            }
          }
    },
    pullRequests: {
      toDevelop: (results.workPullRequests.value ?? []).map(summarizePullRequest),
      toMain: (promotionPrs ?? []).map(summarizePullRequest)
    },
    checks: Object.fromEntries(checks)
  };
}

export function selectRequiredCheck(checkRuns, expectedSha) {
  const exact = (checkRuns ?? [])
    .filter((check) => check.name === REQUIRED_CHECK && check.head_sha === expectedSha)
    .sort((a, b) =>
      String(b.completed_at ?? b.started_at ?? "").localeCompare(
        String(a.completed_at ?? a.started_at ?? "")
      )
    );
  const check = exact[0];
  if (!check)
    return {
      name: REQUIRED_CHECK,
      state: "missing",
      conclusion: null,
      headSha: expectedSha,
      appId: null
    };
  if (check.status !== "completed")
    return {
      name: REQUIRED_CHECK,
      state: "pending",
      conclusion: null,
      headSha: check.head_sha,
      appId: check.app?.id ?? null
    };
  return {
    name: REQUIRED_CHECK,
    state: check.conclusion === "success" ? "success" : "failure",
    conclusion: check.conclusion,
    headSha: check.head_sha,
    appId: check.app?.id ?? null
  };
}

export function buildReadOnlyPlan(status) {
  const local = status.local;
  const github = status.github;
  const changedPackages = local.integrationDiff.changedPublicPackages;
  const diffFresh =
    local.integrationDiff.available &&
    local.refs.main === github?.branches?.main?.sha &&
    local.refs.develop === github?.branches?.develop?.sha;
  const destinations = !diffFresh
    ? {
        aetherPackages: {
          status: "unknown",
          reason: "Refresh both local remote refs before classifying package delivery."
        },
        liminalClient: {
          status: "unknown",
          reason: "Refresh both local remote refs before classifying client delivery."
        }
      }
    : {
        aetherPackages: changedPackages.length
          ? {
              status: "required",
              reason: `${changedPackages.length} public package(s) changed between main and develop.`
            }
          : {
              status: "not_applicable",
              reason: "No public package changes appear in the main-to-develop diff."
            },
        liminalClient: changedPackages.length
          ? {
              status: "required",
              reason:
                "The immutable package release manifest triggers delivery verification in Liminal."
            }
          : {
              status: "not_applicable",
              reason: "No public package release triggers a Liminal client update."
            }
      };
  const blockers = [];
  if (!local.clean) blockers.push("working_tree_dirty");
  if (!local.refs.develop || !local.refs.main) blockers.push("local_remote_refs_missing");
  if (!github || github.state === "unavailable") blockers.push("github_state_unavailable");
  else if (github.state !== "available") blockers.push("github_state_incomplete");
  if (github?.branches?.develop?.sha && local.refs.develop !== github.branches.develop.sha)
    blockers.push("local_develop_ref_stale");
  if (github?.branches?.main?.sha && local.refs.main !== github.branches.main.sha)
    blockers.push("local_main_ref_stale");
  if (!local.integrationDiff.available) blockers.push("local_promotion_diff_unavailable");
  if (local.mainIsAncestorOfDevelop === false)
    blockers.push("develop_requires_main_ancestry_reconciliation");
  if (local.branch !== "develop") blockers.push("not_on_develop");
  if (local.headSha && local.refs.develop && local.headSha !== local.refs.develop)
    blockers.push("local_head_is_not_develop_tip");

  const devProtection = github?.branches?.develop?.protection;
  const mainProtection = github?.branches?.main?.protection;
  if (
    devProtection &&
    (devProtection.protected !== true ||
      devProtection.requiredCheckConfigured !== true ||
      devProtection.requiredCheckAppIdKnown !== true)
  )
    blockers.push("develop_branch_protection_unverified");
  if (
    mainProtection &&
    (mainProtection.protected !== true ||
      mainProtection.requiredCheckConfigured !== true ||
      mainProtection.requiredCheckAppIdKnown !== true)
  )
    blockers.push("main_branch_protection_unverified");

  const developCheck = github?.checks?.develop;
  if (
    developCheck?.state !== "success" ||
    developCheck?.required?.headSha !== github?.branches?.develop?.sha
  )
    blockers.push("develop_exact_head_ci_not_successful");
  if (devProtection?.appId && developCheck?.required?.appId !== devProtection.appId)
    blockers.push("develop_required_check_app_mismatch");
  if (devProtection?.appId && mainProtection?.appId && devProtection.appId !== mainProtection.appId)
    blockers.push("required_check_apps_differ");
  if (local.branch === "develop" && local.integrationDiff.pendingChangesets.length)
    blockers.push("pending_changesets_must_be_released_on_develop");

  const promotion = github?.pullRequests?.toMain?.find(
    (pr) => pr.headRef === "develop" && pr.baseRef === "main"
  );
  let nextAction;
  if (!local.clean) {
    nextAction = {
      action: "resolve_local_changes_before_planning",
      reason: "A dirty worktree prevents a reproducible release plan."
    };
  } else if (local.branch !== "develop") {
    const existing = github?.pullRequests?.toDevelop?.find((pr) => pr.headRef === local.branch);
    nextAction = existing
      ? {
          action: "review_existing_work_pull_request",
          reason: `PR #${existing.number} already targets develop.`
        }
      : {
          action: "review_branch_before_opening_work_pull_request",
          reason: "Only a reviewed branch should enter develop through a pull request."
        };
  } else if (blockers.length) {
    nextAction = { action: "resolve_blockers", reason: blockers.join(", ") };
  } else if (promotion && promotion.headSha !== github.branches.develop.sha) {
    nextAction = {
      action: "synchronize_open_promotion_pull_request",
      reason: `PR #${promotion.number} points to an older develop SHA than the current branch tip.`
    };
  } else if (promotion) {
    const promotionCheck = github.checks?.promotion;
    nextAction =
      promotionCheck?.state === "success" && promotionCheck.required?.headSha === promotion.headSha
        ? {
            action: "review_current_promotion_pull_request",
            reason: `PR #${promotion.number} has a successful exact-head check; review its full diff before merge.`
          }
        : {
            action: "wait_for_promotion_pull_request_ci",
            reason: `PR #${promotion.number} must pass the required check on ${promotion.headSha}.`
          };
  } else {
    nextAction = {
      action: "review_diff_before_opening_promotion_pull_request",
      reason:
        "The exact develop head passed CI; inspect the full main promotion diff before opening its single PR."
    };
  }

  const planId = createHash("sha256")
    .update(
      `${status.repository ?? "unknown"}:${github?.branches?.main?.sha ?? local.refs.main ?? "unknown"}:${github?.branches?.develop?.sha ?? local.refs.develop ?? "unknown"}`
    )
    .digest("hex")
    .slice(0, 20);
  return {
    schemaVersion: 1,
    planId,
    readOnly: true,
    repository: status.repository,
    scope: {
      baseSha: github?.branches?.main?.sha ?? local.refs.main,
      headSha: github?.branches?.develop?.sha ?? local.refs.develop,
      changedFileCount: local.integrationDiff.changedFileCount,
      changedPublicPackages: changedPackages
    },
    destinations,
    blockers,
    nextAction,
    mutationsEnabled: false
  };
}

export async function collectStatus() {
  const local = readLocalStatus();
  const repository = repositorySlug();
  const github = await readGitHubStatus(repository, local);
  return {
    schemaVersion: 1,
    command: "status",
    generatedAt: new Date().toISOString(),
    repository,
    local,
    github
  };
}

function formatHumanStatus(status) {
  const local = status.local;
  const dev = status.github.checks?.develop;
  return [
    `Repository: ${status.repository ?? "unknown"}`,
    `Local: ${local.branch ?? "detached"} @ ${local.headSha ?? "unknown"}${local.clean ? " (clean)" : ` (${local.dirtyCount} local change(s))`}`,
    `origin/develop: ${local.refs.develop ?? "missing"}; origin/main: ${local.refs.main ?? "missing"}`,
    `Public packages in promotion diff: ${local.integrationDiff.changedPublicPackages.map(({ name }) => name).join(", ") || "none"}`,
    `Pending changesets: ${local.integrationDiff.pendingChangesets.length}`,
    `GitHub: ${status.github.state}${status.github.reason ? ` (${status.github.reason})` : ""}`,
    `Required check on develop: ${dev?.state ?? "unavailable"}${dev?.required?.headSha ? ` @ ${dev.required.headSha}` : ""}`
  ].join("\n");
}

function formatHumanPlan(plan) {
  return [
    `Read-only release plan ${plan.planId}`,
    `Scope: ${plan.scope.baseSha ?? "unknown"} → ${plan.scope.headSha ?? "unknown"}`,
    `Public packages: ${plan.scope.changedPublicPackages.map(({ name }) => name).join(", ") || "none"}`,
    `Aether packages: ${plan.destinations.aetherPackages.status} — ${plan.destinations.aetherPackages.reason}`,
    `Liminal client: ${plan.destinations.liminalClient.status} — ${plan.destinations.liminalClient.reason}`,
    `Blockers: ${plan.blockers.join(", ") || "none"}`,
    `Next: ${plan.nextAction.action} — ${plan.nextAction.reason}`,
    "No GitHub, package registry, or deployment mutations are performed."
  ].join("\n");
}

async function main() {
  const command = process.argv[2];
  const json = process.argv.includes("--json");
  if (command !== "status" && command !== "plan") {
    console.error("Usage: node scripts/release-coordinator.mjs <status|plan> [--json]");
    process.exitCode = 2;
    return;
  }
  try {
    const status = await collectStatus();
    if (command === "status") {
      console.log(json ? JSON.stringify(status, null, 2) : formatHumanStatus(status));
      return;
    }
    const plan = buildReadOnlyPlan(status);
    console.log(json ? JSON.stringify(plan, null, 2) : formatHumanPlan(plan));
  } catch (error) {
    console.error(`Release coordinator could not read repository state: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
