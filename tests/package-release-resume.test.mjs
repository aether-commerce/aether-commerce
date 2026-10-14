import assert from "node:assert/strict";
import test from "node:test";
import { hasSuccessfulPushCiRun, packageReleaseResumeErrors } from "../scripts/check-package-release-resume.mjs";

const sha = "a".repeat(40);
const mainSha = "b".repeat(40);
const validContext = {
  eventName: "workflow_dispatch",
  githubRef: "refs/heads/main",
  repository: "aether-commerce/aether-commerce",
  releaseSha: sha,
  currentMainSha: mainSha,
  remoteMainSha: mainSha,
  currentCheckoutSha: mainSha,
  releaseIsAncestor: true,
  buildInputsUnchanged: true,
  releaseCiVerified: true,
  currentMainCiVerified: true
};

test("release resume accepts only an exact, validated main release", () => {
  assert.deepEqual(packageReleaseResumeErrors(validContext), []);
});

test("release resume rejects stale, unrelated, or changed package build inputs", () => {
  const errors = packageReleaseResumeErrors({
    ...validContext,
    githubRef: "refs/heads/develop",
    remoteMainSha: "c".repeat(40),
    releaseIsAncestor: false,
    buildInputsUnchanged: false,
    currentMainCiVerified: false
  });
  assert.ok(errors.includes("release resume must target main"));
  assert.ok(errors.includes("main advanced after the manual resume was requested"));
  assert.ok(errors.includes("resume release SHA is not an ancestor of current main"));
  assert.ok(errors.includes("package source or build inputs changed after the release SHA"));
  assert.ok(errors.includes("no successful Aether CI push run exists for current main"));
});

test("resume requires exact successful push CI for the release SHA", () => {
  const runs = [
    { name: "Aether CI", event: "pull_request", conclusion: "success", head_branch: "main", head_sha: sha },
    { name: "Aether CI", event: "push", conclusion: "failure", head_branch: "main", head_sha: sha },
    { name: "Aether CI", event: "push", conclusion: "success", head_branch: "develop", head_sha: sha },
    { name: "Aether CI", event: "push", conclusion: "success", head_branch: "main", head_sha: mainSha }
  ];
  assert.equal(hasSuccessfulPushCiRun(sha, runs), false);
  assert.equal(hasSuccessfulPushCiRun(mainSha, runs), true);
});
