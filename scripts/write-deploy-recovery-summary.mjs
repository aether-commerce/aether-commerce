import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const STAGES = [
  { key: "authorization", label: "Authorize release SHA", mutating: false },
  { key: "dependencies", label: "Install dependencies", mutating: false },
  { key: "runtime", label: "Verify deployment settings", mutating: false },
  { key: "build", label: "Build workspace", mutating: false },
  { key: "configs", label: "Generate Worker configs", mutating: false },
  { key: "storefrontBuild", label: "Build storefront bundle", mutating: false },
  { key: "buildMetadata", label: "Stamp build metadata", mutating: false },
  { key: "migrations", label: "Apply D1 migrations", mutating: true },
  { key: "api", label: "Deploy API Worker", mutating: true },
  { key: "assistant", label: "Deploy assistant Worker", mutating: true },
  { key: "storefront", label: "Deploy storefront Worker", mutating: true },
  { key: "admin", label: "Deploy Admin Pages", mutating: true },
  { key: "smoke", label: "Verify public services", mutating: false },
  { key: "catalog", label: "Verify production catalog", mutating: false }
];

const VALID_OUTCOMES = new Set(["success", "failure", "cancelled", "skipped"]);

function normalizeOutcome(value, stage) {
  const outcome = value || "skipped";
  if (!VALID_OUTCOMES.has(outcome)) {
    throw new Error(`Unknown GitHub Actions outcome for ${stage}: ${outcome}`);
  }
  return outcome;
}

export function buildDeployRecoveryReport({
  environment,
  targetBranch,
  sourceSha,
  runUrl,
  outcomes
}) {
  if (!["development", "production"].includes(environment)) {
    throw new Error("AETHER_DEPLOY_ENV must be development or production");
  }
  const expectedBranch = environment === "production" ? "main" : "develop";
  if (targetBranch !== expectedBranch) {
    throw new Error(`${environment} deployment must target ${expectedBranch}`);
  }
  if (!/^[a-f0-9]{40}$/i.test(sourceSha ?? "")) {
    throw new Error("DEPLOYED_COMMIT_SHA must be a full 40-character commit SHA");
  }

  const stages = STAGES.map(({ key, label, mutating }) => ({
    key,
    label,
    outcome:
      key === "catalog" && environment === "development"
        ? "not_applicable"
        : normalizeOutcome(outcomes?.[key], key),
    mutating
  }));
  const requiredStages = stages.filter((stage) => stage.outcome !== "not_applicable");
  const firstIncomplete = requiredStages.find((stage) => stage.outcome !== "success");
  const failure = requiredStages.find((stage) => ["failure", "cancelled"].includes(stage.outcome));
  const mutationAttempted = stages.some(
    (stage) => stage.mutating && stage.outcome !== "skipped" && stage.outcome !== "not_applicable"
  );
  const lastSuccessful = [...requiredStages].reverse().find((stage) => stage.outcome === "success");

  let status;
  if (!firstIncomplete) status = "verified";
  else if (failure && mutationAttempted) status = "partial";
  else if (failure) status = "failed_before_mutation";
  else if (mutationAttempted) status = "incomplete_after_mutation";
  else status = "not_started";

  const databaseState =
    stages.find((stage) => stage.key === "migrations")?.outcome === "success"
      ? "migration_step_succeeded"
      : stages.find((stage) => stage.key === "migrations")?.outcome === "skipped"
        ? "not_touched"
        : "unknown";
  const nextAction = mutationAttempted
    ? "Inspect the target D1 migration history and each service revision before retrying. Resume only the current authorized SHA after confirming the cause."
    : failure
      ? "Fix the failed authorization, configuration, dependency, or build stage on a new branch and rerun CI before deployment."
      : "Complete the remaining deployment and verification stages for this SHA.";

  return {
    schemaVersion: 1,
    environment,
    targetBranch,
    sourceSha: sourceSha.toLowerCase(),
    runUrl: runUrl || null,
    status,
    firstIncompleteStage: firstIncomplete?.key ?? null,
    lastSuccessfulStage: lastSuccessful?.key ?? null,
    mutationAttempted,
    databaseState,
    nextAction,
    stages: stages.map(({ key, outcome }) => ({ key, outcome }))
  };
}

export function renderDeployRecoverySummary(report) {
  const lines = [
    `## Deployment recovery snapshot: ${report.status}`,
    "",
    `- Environment: ${report.environment}`,
    `- Target branch: ${report.targetBranch}`,
    `- Source SHA: \`${report.sourceSha}\``,
    report.runUrl ? `- Workflow run: ${report.runUrl}` : null,
    `- First incomplete stage: ${report.firstIncompleteStage ?? "none"}`,
    `- Last successful stage: ${report.lastSuccessfulStage ?? "none"}`,
    `- Remote mutation attempted: ${report.mutationAttempted ? "yes" : "no"}`,
    `- D1 state: ${report.databaseState}`,
    "",
    "| Stage | Outcome |",
    "| --- | --- |",
    ...report.stages.map(({ key, outcome }) => `| ${key} | ${outcome} |`),
    "",
    `Next action: ${report.nextAction}`,
    "",
    "This report records workflow step outcomes only. Confirm Cloudflare D1 and service revisions before any retry; it does not claim that a failed remote operation made no changes."
  ].filter((line) => line !== null);
  return `${lines.join("\n")}\n`;
}

function main() {
  const outcomes = Object.fromEntries(
    STAGES.map(({ key }) => [
      key,
      process.env[`DEPLOY_OUTCOME_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`]
    ])
  );
  const report = buildDeployRecoveryReport({
    environment: process.env.AETHER_DEPLOY_ENV,
    targetBranch: process.env.DEPLOY_TARGET_BRANCH,
    sourceSha: process.env.DEPLOYED_COMMIT_SHA,
    runUrl: process.env.DEPLOY_RUN_URL,
    outcomes
  });
  const markdown = renderDeployRecoverySummary(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  console.log(JSON.stringify(report));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(`Could not create deployment recovery summary: ${error.message}`);
    process.exitCode = 1;
  }
}
