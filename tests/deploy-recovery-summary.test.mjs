import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildDeployRecoveryReport,
  renderDeployRecoverySummary
} from "../scripts/write-deploy-recovery-summary.mjs";

const sha = "a".repeat(40);

function outcomes(overrides = {}) {
  return {
    authorization: "success",
    dependencies: "success",
    runtime: "success",
    build: "success",
    configs: "success",
    storefrontBuild: "success",
    buildMetadata: "success",
    migrations: "success",
    api: "success",
    assistant: "success",
    storefront: "success",
    admin: "success",
    smoke: "success",
    catalog: "success",
    ...overrides
  };
}

function report(environment, stageOutcomes, extra = {}) {
  return buildDeployRecoveryReport({
    environment,
    targetBranch: environment === "production" ? "main" : "develop",
    sourceSha: sha,
    runUrl: "https://github.com/aether-commerce/aether-commerce/actions/runs/123",
    outcomes: stageOutcomes,
    ...extra
  });
}

test("reports a fully verified development deployment and omits production-only catalog gating", () => {
  const result = report("development", outcomes({ catalog: "skipped" }));

  assert.equal(result.status, "verified");
  assert.equal(result.stages.find(({ key }) => key === "catalog").outcome, "not_applicable");
  assert.equal(result.mutationAttempted, true);
  assert.equal(result.databaseState, "migration_step_succeeded");
  assert.match(result.nextAction, /No recovery action is needed/);
});

test("reports an API failure after migration as partial and requires remote inspection", () => {
  const result = report(
    "development",
    outcomes({
      api: "failure",
      assistant: "skipped",
      storefront: "skipped",
      admin: "skipped",
      smoke: "skipped",
      catalog: "skipped"
    })
  );

  assert.equal(result.status, "partial");
  assert.equal(result.firstIncompleteStage, "api");
  assert.equal(result.lastSuccessfulStage, "migrations");
  assert.equal(result.databaseState, "migration_step_succeeded");
  assert.match(result.nextAction, /Inspect the target D1 migration history/);
});

test("reports a later service failure after an earlier Worker has already deployed", () => {
  const result = report(
    "development",
    outcomes({
      assistant: "failure",
      storefront: "skipped",
      admin: "skipped",
      smoke: "skipped",
      catalog: "skipped"
    })
  );
  const markdown = renderDeployRecoverySummary(result);

  assert.equal(result.status, "partial");
  assert.equal(result.firstIncompleteStage, "assistant");
  assert.equal(result.lastSuccessfulStage, "api");
  assert.equal(result.mutationAttempted, true);
  assert.equal(result.databaseState, "migration_step_succeeded");
  assert.match(result.nextAction, /each service revision before retrying/);
  assert.match(markdown, /\| api \| success \|/);
  assert.match(markdown, /\| assistant \| failure \|/);
  assert.match(markdown, /does not claim that a failed remote operation made no changes/);
});

test("development recovery drill is manual-only, fails after API, and leaves production untouched", () => {
  const developmentWorkflow = readFileSync(
    new URL("../.github/workflows/deploy-development.yml", import.meta.url),
    "utf8"
  );
  const productionWorkflow = readFileSync(
    new URL("../.github/workflows/deploy-production.yml", import.meta.url),
    "utf8"
  );
  assert.match(developmentWorkflow, /recovery_drill_fail_after_api:/);
  assert.match(developmentWorkflow, /github\.event_name }}" = 'workflow_dispatch'/);
  assert.match(developmentWorkflow, /Intentional development recovery drill: API deployed/);
  assert.ok(
    developmentWorkflow.indexOf("Intentional development recovery drill") >
      developmentWorkflow.indexOf("Deploy development API Worker")
  );
  assert.doesNotMatch(productionWorkflow, /recovery_drill_fail_after_api/);
});

test("treats a failed migration operation as remotely uncertain", () => {
  const result = report(
    "production",
    outcomes({
      migrations: "failure",
      api: "skipped",
      assistant: "skipped",
      storefront: "skipped",
      admin: "skipped",
      smoke: "skipped",
      catalog: "skipped"
    })
  );

  assert.equal(result.status, "partial");
  assert.equal(result.mutationAttempted, true);
  assert.equal(result.databaseState, "unknown");
  assert.equal(result.firstIncompleteStage, "migrations");
});

test("distinguishes a build failure before any remote mutation", () => {
  const result = report(
    "development",
    outcomes({
      build: "failure",
      configs: "skipped",
      storefrontBuild: "skipped",
      buildMetadata: "skipped",
      migrations: "skipped",
      api: "skipped",
      assistant: "skipped",
      storefront: "skipped",
      admin: "skipped",
      smoke: "skipped",
      catalog: "skipped"
    })
  );

  assert.equal(result.status, "failed_before_mutation");
  assert.equal(result.firstIncompleteStage, "build");
  assert.equal(result.lastSuccessfulStage, "runtime");
  assert.equal(result.mutationAttempted, false);
  assert.equal(result.databaseState, "not_touched");
});

test("production is incomplete until its catalog check succeeds", () => {
  const result = report("production", outcomes({ catalog: "skipped" }));

  assert.equal(result.status, "incomplete_after_mutation");
  assert.equal(result.firstIncompleteStage, "catalog");
  assert.equal(result.stages.find(({ key }) => key === "catalog").outcome, "skipped");
});

test("rejects an environment paired with the wrong canonical branch or an abbreviated SHA", () => {
  assert.throws(
    () => report("production", outcomes(), { targetBranch: "develop" }),
    /production deployment must target main/
  );
  assert.throws(
    () => report("development", outcomes(), { sourceSha: "abcdef0" }),
    /full 40-character commit SHA/
  );
});

test("renders workflow outcomes and recovery guidance without including secret values", () => {
  const result = report(
    "development",
    outcomes({
      api: "failure",
      assistant: "skipped",
      storefront: "skipped",
      admin: "skipped",
      smoke: "skipped",
      catalog: "skipped"
    })
  );
  const markdown = renderDeployRecoverySummary(result);

  assert.match(markdown, /Deployment recovery snapshot: partial/);
  assert.match(markdown, /\| migrations \| success \|/);
  assert.match(markdown, /\| api \| failure \|/);
  assert.match(markdown, /Confirm Cloudflare D1 and service revisions/);
  assert.doesNotMatch(markdown, /secret|token|password/i);
});

test("workflow CLI writes its JSON result and Markdown snapshot to the GitHub summary file", () => {
  const directory = mkdtempSync(join(tmpdir(), "aether-deploy-recovery-"));
  const summaryPath = join(directory, "summary.md");
  try {
    const env = {
      ...process.env,
      AETHER_DEPLOY_ENV: "development",
      DEPLOY_TARGET_BRANCH: "develop",
      DEPLOYED_COMMIT_SHA: sha,
      DEPLOY_RUN_URL: "https://github.com/aether-commerce/aether-commerce/actions/runs/456",
      GITHUB_STEP_SUMMARY: summaryPath,
      ...Object.fromEntries(
        Object.entries(
          outcomes({
            api: "failure",
            assistant: "skipped",
            storefront: "skipped",
            admin: "skipped",
            smoke: "skipped",
            catalog: "skipped"
          })
        ).map(([key, value]) => [
          `DEPLOY_OUTCOME_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`,
          value
        ])
      )
    };
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../scripts/write-deploy-recovery-summary.mjs", import.meta.url))],
      { encoding: "utf8", env }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "partial");
    assert.match(readFileSync(summaryPath, "utf8"), /Deployment recovery snapshot: partial/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
