import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = resolve(repositoryRoot, "apps/ai-assistant/evaluation/run.mjs");

test("AI evaluation runner fails when a category selects no cases", () => {
  const result = spawnSync(process.execPath, [runnerPath, "--category", "missing-category"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, AETHER_AI_EVAL_URL: "http://127.0.0.1:1" }
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /No evaluation cases selected for category "missing-category"\./);
  assert.match(result.stderr, /recommendation/);
});
