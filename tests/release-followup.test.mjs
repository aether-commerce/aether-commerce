import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { decideResume, runPhase } from "../scripts/release-followup.mjs";
import { cleanupDecision, mergeDecision, syncDecision } from "../scripts/sync-main-history.mjs";

const sha = "a".repeat(40);
const developSha = "b".repeat(40);

function verification(changes = {}) {
  return {
    releaseSha: sha,
    phases: {
      ci: { status: "success" },
      deployment: { status: "success" },
      publication: { status: "not_applicable" },
      manifest: { status: "not_applicable" },
      client: { status: "not_applicable" },
      history: { status: "success" },
      ...changes
    }
  };
}

test("history sync never acts on a stale CI SHA and is idempotent when ancestry is present", () => {
  assert.equal(
    syncDecision({
      mainSha: sha,
      developSha,
      mainIsAncestor: false,
      sourceSha: developSha,
      sourceIsCurrent: true
    }).action,
    "block"
  );
  assert.equal(
    syncDecision({
      mainSha: sha,
      developSha,
      mainIsAncestor: true,
      sourceSha: sha,
      sourceIsCurrent: true
    }).action,
    "done"
  );
  assert.equal(
    syncDecision({
      mainSha: sha,
      developSha,
      mainIsAncestor: false,
      sourceSha: sha,
      sourceIsCurrent: true
    }).action,
    "create"
  );
  assert.equal(
    syncDecision({
      mainSha: sha,
      developSha,
      mainIsAncestor: false,
      sourceSha: sha,
      sourceIsCurrent: true,
      existingPr: "347"
    }).action,
    "update"
  );
});

test("cleanup deletes only a merged temporary history branch after exact develop push CI", () => {
  const base = {
    branchSha: sha,
    developSha,
    sourceSha: developSha,
    openPr: "",
    branchIsAncestor: true
  };
  assert.equal(cleanupDecision(base).action, "delete");
  assert.equal(cleanupDecision({ ...base, sourceSha: sha }).action, "block");
  assert.equal(cleanupDecision({ ...base, openPr: "348" }).action, "wait");
  assert.equal(cleanupDecision({ ...base, branchIsAncestor: false }).action, "block");
  assert.equal(cleanupDecision({ ...base, branchSha: "" }).action, "done");
});

test("history PR merges only for exact-head CI, current branch ancestry, and zero file diff", () => {
  const base = {
    sourceSha: sha,
    headSha: sha,
    remoteHeadSha: sha,
    mainIsAncestor: true,
    developIsAncestor: true,
    changedFiles: []
  };
  assert.equal(mergeDecision(base).action, "merge");
  assert.equal(mergeDecision({ ...base, sourceSha: developSha }).action, "block");
  assert.equal(mergeDecision({ ...base, remoteHeadSha: developSha }).action, "block");
  assert.equal(mergeDecision({ ...base, mainIsAncestor: false }).action, "block");
  assert.equal(mergeDecision({ ...base, developIsAncestor: false }).action, "block");
  assert.equal(mergeDecision({ ...base, changedFiles: ["package.json"] }).action, "review");
});

test("resume waits for an existing run and never dispatches without successful exact main CI", () => {
  assert.equal(
    decideResume(verification({ ci: { status: "failed" }, deployment: { status: "missing" } }))
      .action,
    "block"
  );
  assert.equal(decideResume(verification({ deployment: { status: "pending" } })).action, "wait");
  assert.equal(
    decideResume(verification({ deployment: { status: "failed" } })).workflow,
    "deploy-production.yml"
  );
});

test("package recovery requires an immutable manifest and never republishes from resume", () => {
  const noManifest = decideResume(
    verification({ publication: { status: "failed" }, manifest: { status: "missing" } })
  );
  assert.equal(noManifest.action, "block");
  const recovered = decideResume(
    verification({ publication: { status: "failed" }, manifest: { status: "success" } })
  );
  assert.equal(recovered.workflow, "publish-packages.yml");
  assert.deepEqual(recovered.inputs, { resume_release_sha: sha });
});

test("history reconciliation is a distinct resumable stage", () => {
  assert.equal(
    decideResume(verification({ history: { status: "missing" } })).workflow,
    "sync-main-history.yml"
  );
  assert.equal(decideResume(verification({ history: { status: "pending" } })).action, "wait");
  assert.equal(decideResume(verification()).action, "done");
});

test("run evidence preserves failed and pending conclusions", () => {
  assert.equal(runPhase(null, "deploy").status, "missing");
  assert.equal(runPhase({ status: "in_progress" }, "deploy").status, "pending");
  assert.equal(runPhase({ status: "completed", conclusion: "failure" }, "deploy").status, "failed");
});

test("release scripts and a bot-authenticated history workflow are wired", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts["release:verify"], "node scripts/release-coordinator.mjs verify");
  assert.equal(pkg.scripts["release:resume"], "node scripts/release-coordinator.mjs resume");
  const workflow = readFileSync(
    new URL("../.github/workflows/sync-main-history.yml", import.meta.url),
    "utf8"
  );
  assert.match(workflow, /AETHER_RELEASE_TOKEN/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /check-deploy-authorization\.mjs/);
  assert.match(workflow, /sync-main-history\.mjs/);
  assert.match(workflow, /node scripts\/sync-main-history\.mjs cleanup/);
  assert.match(workflow, /node scripts\/sync-main-history\.mjs merge/);
  assert.match(workflow, /head_branch == 'chore\/sync-main-to-develop'/);
  assert.doesNotMatch(workflow, /pull_request_target/);
});
