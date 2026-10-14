import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  deploymentAuthorizationErrors,
  hasSuccessfulCiRun
} from "../scripts/check-deploy-authorization.mjs";
import { releaseBranchErrors } from "../scripts/check-release-branch.mjs";
import { ciStatus } from "../scripts/wait-for-release-ci.mjs";

const checker = fileURLToPath(new URL("../scripts/check-changesets.mjs", import.meta.url));
const promotionChecker = fileURLToPath(
  new URL("../scripts/check-promotion-readiness.mjs", import.meta.url)
);

test("deployment authorization accepts only fresh push CI or an explicit target branch", () => {
  const sha = "a".repeat(40);
  const valid = {
    eventName: "workflow_run",
    githubRef: "refs/heads/main",
    repository: "aether-commerce/aether-commerce",
    targetBranch: "main",
    expectedSha: sha,
    workflowName: "Aether CI",
    upstreamEvent: "push",
    upstreamConclusion: "success",
    upstreamRepository: "aether-commerce/aether-commerce",
    upstreamBranch: "main",
    upstreamSha: sha,
    currentBranchSha: sha,
    currentCheckoutSha: sha
  };
  assert.deepEqual(deploymentAuthorizationErrors(valid), []);
  assert.match(
    deploymentAuthorizationErrors({ ...valid, upstreamEvent: "pull_request" }).join(";"),
    /only a push CI run/
  );
  assert.match(
    deploymentAuthorizationErrors({ ...valid, upstreamConclusion: "failure" }).join(";"),
    /conclude successfully/
  );
  assert.match(
    deploymentAuthorizationErrors({ ...valid, currentBranchSha: "b".repeat(40) }).join(";"),
    /is stale/
  );
  assert.match(
    deploymentAuthorizationErrors({ ...valid, currentCheckoutSha: "b".repeat(40) }).join(";"),
    /checked out source SHA/
  );
  assert.match(
    deploymentAuthorizationErrors({
      ...valid,
      eventName: "workflow_dispatch",
      githubRef: "refs/heads/develop"
    }).join(";"),
    /manual deployment must target/
  );
  const successfulRun = {
    name: "Aether CI",
    path: ".github/workflows/ci.yml",
    event: "push",
    conclusion: "success",
    head_branch: "main",
    head_sha: sha
  };
  assert.equal(hasSuccessfulCiRun({ ...valid }, [successfulRun]), true);
  assert.equal(
    hasSuccessfulCiRun({ ...valid }, [{ ...successfulRun, conclusion: "failure" }]),
    false
  );
  assert.equal(
    hasSuccessfulCiRun({ ...valid }, [{ ...successfulRun, head_sha: "b".repeat(40) }]),
    false
  );
});

test("release branch accepts only consumed notes and generated public package artifacts", () => {
  const packages = [{ directory: "demo", private: false }];
  const valid = [
    "D\t.changeset/demo-note.md",
    "M\tpackages/demo/package.json",
    "A\tpackages/demo/CHANGELOG.md"
  ];
  assert.deepEqual(releaseBranchErrors(valid, packages), []);
  assert.match(
    releaseBranchErrors([...valid, "M\tpackages/demo/src/index.ts"], packages).join(";"),
    /non-generated path/
  );
  assert.match(
    releaseBranchErrors(["A\t.changeset/new-note.md", "M\tpackages/demo/package.json"], packages).join(";"),
    /non-generated path/
  );
  assert.match(
    releaseBranchErrors(["D\t.changeset/demo-note.md", "M\tpackages/demo/CHANGELOG.md"], packages).join(";"),
    /metadata is missing/
  );
});

test("release automation waits for successful push CI on the exact develop SHA", () => {
  const source = { branch: "develop", sha: "a".repeat(40) };
  const run = {
    name: "Aether CI",
    path: ".github/workflows/ci.yml",
    event: "push",
    status: "completed",
    conclusion: "success",
    head_branch: "develop",
    head_sha: source.sha,
    run_attempt: 1
  };
  assert.equal(ciStatus([run], source).state, "success");
  assert.equal(ciStatus([{ ...run, conclusion: "failure" }], source).state, "failure");
  assert.equal(ciStatus([{ ...run, head_sha: "b".repeat(40) }], source).state, "pending");
  assert.equal(ciStatus([{ ...run, event: "pull_request" }], source).state, "pending");
  assert.equal(ciStatus([{ ...run, status: "in_progress", conclusion: null }], source).state, "pending");
});

function command(cwd, program, args) {
  const result = spawnSync(program, args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function write(root, path, value) {
  const target = join(root, path);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, value);
}

function makeRepo(defaultBranch = "develop") {
  const root = mkdtempSync(join(process.cwd(), ".tmp-cicd-policy-"));
  command(root, "git", ["init", "--initial-branch=" + defaultBranch]);
  command(root, "git", ["config", "user.name", "CI policy test"]);
  command(root, "git", ["config", "user.email", "ci-policy@example.invalid"]);
  write(root, "package.json", JSON.stringify({ name: "fixture", private: true }) + "\n");
  write(
    root,
    "packages/demo/package.json",
    JSON.stringify({
      name: "@aether/demo",
      version: "1.0.0",
      private: false
    }) + "\n"
  );
  write(root, "packages/demo/src/index.js", "export const value = 1;\n");
  write(root, ".changeset/README.md", "Changesets fixture\n");
  command(root, "git", ["add", "-A"]);
  command(root, "git", ["commit", "-m", "fixture baseline"]);
  command(root, "git", ["update-ref", "refs/remotes/origin/" + defaultBranch, "HEAD"]);
  return root;
}

function runScript(root, script, env = {}) {
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GITHUB_BASE_REF: "develop", ...env }
  });
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test("local changeset preflight fails when a public package has no note", () => {
  const root = makeRepo();
  try {
    command(root, "git", ["switch", "-c", "feat/change"]);
    write(root, "packages/demo/src/index.js", "export const value = 2;\n");
    const result = runScript(root, checker);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Every changed public package needs a new, valid changeset/);
  } finally {
    cleanup(root);
  }
});

test("changeset coverage validates every public package and the release level", () => {
  const root = makeRepo();
  try {
    command(root, "git", ["switch", "-c", "feat/change"]);
    write(root, "packages/demo/src/index.js", "export const value = 2;\n");
    write(
      root,
      ".changeset/demo-change.md",
      '---\n"@aether/demo": patch\n---\n\nDescribe the user-visible change.\n'
    );
    const passing = runScript(root, checker);
    assert.equal(passing.status, 0, passing.stderr || passing.stdout);

    write(
      root,
      ".changeset/demo-change.md",
      '---\n"@aether/missing": patch\n---\n\nInvalid note.\n'
    );
    const failing = runScript(root, checker);
    assert.equal(failing.status, 1);
    assert.match(failing.stderr, /Invalid changeset.*unknown or non-public package/);
  } finally {
    cleanup(root);
  }
});

test("release trigger validates pending notes before setup and skips empty releases", () => {
  const root = makeRepo();
  const output = join(root, "github-output");
  try {
    let result = spawnSync(process.execPath, [checker, "--validate-pending"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, GITHUB_OUTPUT: output }
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /No pending changesets/);
    assert.match(readFileSync(output, "utf8"), /release_needed=false/);

    write(
      root,
      ".changeset/demo-note.md",
      '---\n"@aether/demo": patch\n---\n\nRelease description.\n'
    );
    result = spawnSync(process.execPath, [checker, "--validate-pending"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, GITHUB_OUTPUT: output }
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(readFileSync(output, "utf8"), /release_needed=true/);
  } finally {
    cleanup(root);
  }
});

test("deleting a changeset on a feature branch cannot bypass package coverage", () => {
  const root = makeRepo();
  try {
    write(root, ".changeset/old-note.md", '---\n"@aether/demo": patch\n---\n\nExisting note.\n');
    command(root, "git", ["add", "-A"]);
    command(root, "git", ["commit", "-m", "add baseline changeset"]);
    command(root, "git", ["update-ref", "refs/remotes/origin/develop", "HEAD"]);
    command(root, "git", ["switch", "-c", "feat/change"]);
    command(root, "git", ["rm", ".changeset/old-note.md"]);
    write(root, "packages/demo/src/index.js", "export const value = 2;\n");
    const result = runScript(root, checker);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Only the Changesets release PR may consume notes/);
  } finally {
    cleanup(root);
  }
});

test("generated Changesets release accepts consumed notes and generated package metadata only", () => {
  const root = makeRepo();
  try {
    write(
      root,
      ".changeset/demo-change.md",
      '---\n"@aether/demo": minor\n---\n\nDescribe the release.\n'
    );
    command(root, "git", ["add", "-A"]);
    command(root, "git", ["commit", "-m", "add release note"]);
    command(root, "git", ["update-ref", "refs/remotes/origin/develop", "HEAD"]);
    command(root, "git", ["switch", "-c", "changeset-release/develop"]);
    command(root, "git", ["rm", ".changeset/demo-change.md"]);
    write(
      root,
      "packages/demo/package.json",
      JSON.stringify({
        name: "@aether/demo",
        version: "1.1.0",
        private: false
      }) + "\n"
    );
    write(
      root,
      "packages/demo/CHANGELOG.md",
      "# @aether/demo\n\n## 1.1.0\n\n- Describe the release.\n"
    );
    command(root, "git", ["add", "-A"]);
    command(root, "git", ["commit", "-m", "prepare package release"]);
    const result = runScript(root, checker, {
      GITHUB_BASE_REF: "develop",
      GITHUB_HEAD_REF: "changeset-release/develop"
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Validated generated Changesets release/);
  } finally {
    cleanup(root);
  }
});

test("promotion fails on pending notes or unversioned public package changes", () => {
  const root = makeRepo("main");
  try {
    command(root, "git", ["switch", "-c", "develop"]);
    write(root, "packages/demo/src/index.js", "export const value = 2;\n");
    write(
      root,
      ".changeset/demo-change.md",
      '---\n"@aether/demo": patch\n---\n\nDescribe the change.\n'
    );
    command(root, "git", ["add", "-A"]);
    command(root, "git", ["commit", "-m", "change package without release"]);

    let result = runScript(root, promotionChecker, {
      GITHUB_BASE_REF: "",
      GITHUB_EVENT_NAME: "pull_request"
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unconsumed changesets remain/);
    assert.match(result.stderr, /no valid package version increase/);

    command(root, "git", ["rm", ".changeset/demo-change.md"]);
    write(
      root,
      "packages/demo/package.json",
      JSON.stringify({
        name: "@aether/demo",
        version: "1.0.1",
        private: false
      }) + "\n"
    );
    command(root, "git", ["add", "-A"]);
    command(root, "git", ["commit", "-m", "version package for promotion"]);
    result = runScript(root, promotionChecker, {
      GITHUB_BASE_REF: "",
      GITHUB_EVENT_NAME: "pull_request"
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /no pending changesets/);
  } finally {
    cleanup(root);
  }
});

test("changeset preflight refuses an unavailable base instead of passing silently", () => {
  const root = makeRepo();
  try {
    command(root, "git", ["switch", "-c", "feat/change"]);
    const result = runScript(root, checker, { GITHUB_BASE_REF: "does-not-exist" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /does not resolve to a commit/);
  } finally {
    cleanup(root);
  }
});
