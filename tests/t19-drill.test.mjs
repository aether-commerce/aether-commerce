import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { drillDecision } from "../scripts/t19-drill.mjs";

const sha = "a".repeat(40);
const packages = [{ name: "@aether-commerce/migrations", published: false }, { name: "@aether-commerce/api-client", published: false }];
const valid = { target: sha, parent: sha, event: "workflow_run", resume: false, packages };
test("drill only affects the exact requested merge and never a resumed run", () => {
  assert.equal(drillDecision(valid).enabled, true);
  assert.equal(drillDecision({ ...valid, target: "" }).enabled, false);
  assert.equal(drillDecision({ ...valid, parent: "b".repeat(40) }).enabled, false);
  assert.equal(drillDecision({ ...valid, resume: true }).enabled, false);
  assert.equal(drillDecision({ ...valid, event: "workflow_dispatch" }).enabled, false);
  assert.throws(() => drillDecision({ ...valid, target: "main" }), /full SHA/);
});
test("drill refuses a single package, wrong package, or already published version", () => {
  assert.throws(() => drillDecision({ ...valid, packages: [packages[0]] }), /at least two/);
  assert.throws(() => drillDecision({ ...valid, packages: [{ name: "other" }, packages[1]] }), /including migrations/);
  assert.throws(() => drillDecision({ ...valid, packages: [packages[0], { ...packages[1], published: true }] }), /unpublished/);
});
test("workflow stops after one package and before tags, manifest and client notification", () => {
  const workflow = readFileSync(new URL("../.github/workflows/publish-packages.yml", import.meta.url), "utf8");
  const check = workflow.indexOf('drill="$(node scripts/t19-drill.mjs)"');
  const publish = workflow.indexOf("pnpm --dir packages/migrations publish --no-git-checks", check);
  const stop = workflow.indexOf("exit 75", publish);
  const tags = workflow.indexOf("- name: Verify package publication and ensure release tags");
  assert.ok(check > 0 && check < publish && publish < stop && stop < tags);
  assert.match(workflow, /AETHER_T19_DRILL_HEAD: \$\{\{ vars\.AETHER_T19_DRILL_HEAD \}\}/);
  assert.match(workflow, /RELEASE_RESUME_SHA: \$\{\{ inputs\.resume_release_sha \}\}/);
});
