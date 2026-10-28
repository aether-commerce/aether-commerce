import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const BRANCH = "chore/sync-main-to-develop";
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const gh = (...args) =>
  execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

export function syncDecision({
  mainSha,
  developSha,
  mainIsAncestor,
  sourceSha,
  sourceIsCurrent,
  existingPr
}) {
  if (!/^[0-9a-f]{40}$/i.test(mainSha) || !/^[0-9a-f]{40}$/i.test(developSha))
    return { action: "block", reason: "Remote branch SHAs are unavailable." };
  if (sourceSha !== mainSha || !sourceIsCurrent)
    return {
      action: "block",
      reason: "The successful main CI run is no longer the current main head."
    };
  if (mainIsAncestor) return { action: "done", reason: "develop already contains main history." };
  return {
    action: existingPr ? "update" : "create",
    reason: "main history must enter develop through a PR."
  };
}

export function runHistorySync() {
  if (!process.env.GH_TOKEN)
    throw new Error("AETHER_RELEASE_TOKEN is required for the history PR.");
  git("fetch", "origin", "develop", "main");
  const mainSha = git("rev-parse", "origin/main");
  const developSha = git("rev-parse", "origin/develop");
  const sourceSha = process.env.RELEASE_SOURCE_SHA ?? "";
  const sourceIsCurrent = git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0] === mainSha;
  const existingPr = gh(
    "pr",
    "list",
    "--state",
    "open",
    "--base",
    "develop",
    "--head",
    BRANCH,
    "--json",
    "number",
    "--jq",
    ".[0].number // empty"
  );
  const decision = syncDecision({
    mainSha,
    developSha,
    sourceSha,
    sourceIsCurrent,
    existingPr,
    mainIsAncestor: gitAncestor(mainSha, developSha)
  });
  if (decision.action === "block") throw new Error(decision.reason);
  if (decision.action === "done") {
    console.log(decision.reason);
    return decision;
  }

  git("config", "user.name", "aether-release-bot");
  git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
  const remoteBranch = git("ls-remote", "--heads", "origin", BRANCH).split(/\s+/)[0];
  let branchExists = Boolean(remoteBranch);
  if (branchExists && !existingPr) {
    git("fetch", "origin", `refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`);
    if (!gitAncestor(remoteBranch, developSha))
      throw new Error(
        `${BRANCH} exists without an open PR and has commits outside develop; inspect it before reuse.`
      );
    git("push", "origin", "--delete", BRANCH);
    branchExists = false;
  }
  if (branchExists) {
    git("fetch", "origin", `refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`);
    git("switch", "--create", BRANCH, "origin/" + BRANCH);
    if (!gitAncestor(developSha, git("rev-parse", "HEAD")))
      git("merge", "--no-ff", "--no-edit", "origin/develop");
  } else {
    git("switch", "--create", BRANCH, "origin/develop");
  }
  if (!gitAncestor(mainSha, git("rev-parse", "HEAD")))
    git("merge", "--no-ff", "--no-edit", "origin/main");
  const changedFiles = git("diff", "--name-only", "origin/develop", "HEAD")
    .split(/\r?\n/)
    .filter(Boolean);
  git("push", "origin", `HEAD:refs/heads/${BRANCH}`);
  const body = [
    `Sync production commit \`${mainSha}\` into \`develop\` so the next promotion retains ancestry.`,
    "",
    `Base develop: \`${developSha}\`.`,
    `Changed files: ${changedFiles.length}.`,
    "",
    "Review any file changes and let Aether CI / validate pass on this PR's current head."
  ].join("\n");
  if (existingPr) {
    const url = gh("pr", "view", existingPr, "--json", "url", "--jq", ".url");
    enableHistoryAutoMerge(url, changedFiles);
    console.log(`Updated history PR ${url}`);
    return { action: "update", url, changedFiles };
  }
  const url = gh(
    "pr",
    "create",
    "--base",
    "develop",
    "--head",
    BRANCH,
    "--title",
    "chore: sync main history into develop",
    "--body",
    body
  );
  enableHistoryAutoMerge(url, changedFiles);
  console.log(`Created history PR ${url}`);
  return { action: "create", url, changedFiles };
}

function enableHistoryAutoMerge(url, changedFiles) {
  if (changedFiles.length) {
    console.log(
      `History PR changes ${changedFiles.length} file(s); review is required before merge.`
    );
    return;
  }
  const headSha = git("rev-parse", "HEAD");
  gh("pr", "merge", url, "--auto", "--merge", "--delete-branch", "--match-head-commit", headSha);
  console.log(`Enabled protected auto-merge for history-only PR ${url} @ ${headSha}.`);
}

function gitAncestor(ancestor, descendant) {
  try {
    git("merge-base", "--is-ancestor", ancestor, descendant);
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runHistorySync();
  } catch (error) {
    console.error(`::error::History sync failed: ${error.message}`);
    process.exitCode = 1;
  }
}
