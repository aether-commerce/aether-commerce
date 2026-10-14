import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveEvaluationRevision,
  selectEvaluationCases,
  summarizeEvaluation
} from "../apps/api/evaluation/run.mjs";

const cases = [
  { id: "hello-001", category: "conversational", turns: [{ input: "Hola" }] },
  { id: "catalog-001", category: "search", turns: [{ input: "Busca productos" }] }
];

test("evaluation selection rejects unknown categories and zero cases", () => {
  assert.throws(
    () => selectEvaluationCases(cases, { category: "unknown" }),
    /Unknown evaluation category.*conversational, search/
  );
  assert.throws(() => selectEvaluationCases([], {}), /zero cases/);
  assert.throws(() => selectEvaluationCases(cases, { limit: 0 }), /positive integer/);
});

test("evaluation selection reports only the selected cases", () => {
  assert.deepEqual(selectEvaluationCases(cases, { category: "search", limit: 20 }), {
    cases: [cases[1]],
    categories: ["conversational", "search"]
  });
});

test("evaluation evidence records revision, case identifiers, and pass counts", () => {
  const revision = "f".repeat(40);
  const summary = summarizeEvaluation(
    [
      { id: "hello-001", category: "conversational", checks: [{ name: "message", pass: true }] },
      { id: "catalog-001", category: "search", checks: [{ name: "artifact", pass: false }] }
    ],
    { revision, category: "all", worktreeDirty: true }
  );

  assert.deepEqual(summary, {
    type: "evaluation_summary",
    revision,
    worktreeDirty: true,
    category: "all",
    caseIds: ["hello-001", "catalog-001"],
    evaluated: 2,
    passed: 1,
    failed: 1,
    ratio: 0.5,
    summaryByCategory: { conversational: "1/1", search: "0/1" }
  });
  assert.throws(() => summarizeEvaluation([], { revision }), /zero results/);
});

test("evaluation revision requires a full Git SHA", () => {
  const revision = "0123456789abcdef0123456789abcdef01234567";
  assert.equal(
    resolveEvaluationRevision(
      { AETHER_EVAL_SHA: revision },
      { isWorktreeDirty: () => true }
    ).worktreeDirty,
    true
  );
  assert.equal(
    resolveEvaluationRevision(
      {},
      { getHeadRevision: () => revision, isWorktreeDirty: () => false }
    ).revision,
    revision
  );
  assert.throws(
    () => resolveEvaluationRevision({ AETHER_EVAL_SHA: "unknown" }, { isWorktreeDirty: () => false }),
    /full 40-character Git SHA/
  );
});
