import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  REQUIRED_CHECK,
  buildReadOnlyPlan,
  selectRequiredCheck
} from "../scripts/release-coordinator.mjs";

const mainSha = "1".repeat(40);
const developSha = "2".repeat(40);
const appId = 15368;

function validStatus(overrides = {}) {
  const local = {
    branch: "develop",
    headSha: developSha,
    clean: true,
    dirtyCount: 0,
    refs: { main: mainSha, develop: developSha },
    mainIsAncestorOfDevelop: true,
    integrationDiff: {
      available: true,
      changedFileCount: 0,
      changedPublicPackages: [],
      changedClientTemplate: false,
      pendingChangesets: []
    },
    ...overrides.local
  };
  const baseGithub = {
    state: "available",
    branches: {
      main: {
        sha: mainSha,
        protection: {
          protected: true,
          requiredCheckConfigured: true,
          requiredCheckAppIdKnown: true,
          appId
        }
      },
      develop: {
        sha: developSha,
        protection: {
          protected: true,
          requiredCheckConfigured: true,
          requiredCheckAppIdKnown: true,
          appId
        }
      }
    },
    checks: {
      develop: {
        state: "success",
        sha: developSha,
        required: {
          name: REQUIRED_CHECK,
          state: "success",
          conclusion: "success",
          headSha: developSha,
          appId
        }
      },
      promotion: { state: "missing", sha: null, required: null }
    },
    pullRequests: { toDevelop: [], toMain: [] }
  };
  const github = {
    ...baseGithub,
    ...overrides.github,
    branches: { ...baseGithub.branches, ...overrides.github?.branches },
    checks: { ...baseGithub.checks, ...overrides.github?.checks },
    pullRequests: { ...baseGithub.pullRequests, ...overrides.github?.pullRequests }
  };
  return { repository: "aether-commerce/aether-commerce", local, github };
}

test("selects only a successful required check attached to the exact head SHA", () => {
  const check = {
    name: REQUIRED_CHECK,
    status: "completed",
    conclusion: "success",
    head_sha: developSha,
    app: { id: appId }
  };
  assert.equal(selectRequiredCheck([check], developSha).state, "success");
  assert.equal(selectRequiredCheck([check], mainSha).state, "missing");
});

test("does not treat a pending or failed required check as successful", () => {
  assert.equal(
    selectRequiredCheck(
      [{ name: REQUIRED_CHECK, status: "in_progress", head_sha: developSha }],
      developSha
    ).state,
    "pending"
  );
  assert.equal(
    selectRequiredCheck(
      [{ name: REQUIRED_CHECK, status: "completed", conclusion: "failure", head_sha: developSha }],
      developSha
    ).state,
    "failure"
  );
});

test("marks public packages and the client destination required when their artifacts changed", () => {
  const status = validStatus({
    local: {
      integrationDiff: {
        available: true,
        changedFileCount: 3,
        changedPublicPackages: [
          { name: "@aether-commerce/api-worker", directory: "packages/api-worker" }
        ],
        changedClientTemplate: false,
        pendingChangesets: []
      }
    }
  });
  const plan = buildReadOnlyPlan(status);
  assert.equal(plan.destinations.aetherPackages.status, "required");
  assert.equal(plan.destinations.liminalClient.status, "required");
  assert.equal(plan.mutationsEnabled, false);
  assert.equal(plan.readOnly, true);
});

test("returns reasoned not_applicable states when release destinations have no changes", () => {
  const plan = buildReadOnlyPlan(validStatus());
  assert.deepEqual(plan.destinations.aetherPackages, {
    status: "not_applicable",
    reason: "No public package changes appear in the main-to-develop diff."
  });
  assert.deepEqual(plan.destinations.liminalClient, {
    status: "not_applicable",
    reason: "No public package release triggers a Liminal client update."
  });
});

test("blocks a dirty worktree before suggesting any release transition", () => {
  const plan = buildReadOnlyPlan(validStatus({ local: { clean: false, dirtyCount: 2 } }));
  assert.ok(plan.blockers.includes("working_tree_dirty"));
  assert.equal(plan.nextAction.action, "resolve_local_changes_before_planning");
  assert.equal(plan.mutationsEnabled, false);
});

test("does not classify destinations from stale local refs", () => {
  const staleSha = "3".repeat(40);
  const status = validStatus({ local: { refs: { main: mainSha, develop: staleSha } } });
  const plan = buildReadOnlyPlan(status);
  assert.ok(plan.blockers.includes("local_develop_ref_stale"));
  assert.equal(plan.destinations.aetherPackages.status, "unknown");
  assert.equal(plan.destinations.liminalClient.status, "unknown");
});

test("requires branch protection and the configured GitHub App to agree with the exact check", () => {
  const status = validStatus({
    github: {
      branches: {
        develop: {
          sha: developSha,
          protection: {
            protected: true,
            requiredCheckConfigured: true,
            requiredCheckAppIdKnown: true,
            appId: 42
          }
        }
      },
      checks: {
        develop: { state: "success", sha: developSha, required: { headSha: developSha, appId } }
      }
    }
  });
  const plan = buildReadOnlyPlan(status);
  assert.ok(plan.blockers.includes("develop_required_check_app_mismatch"));
});

test("recommends review of the existing promotion PR only after its exact-head check passes", () => {
  const status = validStatus({
    github: {
      pullRequests: {
        toMain: [{ number: 317, headRef: "develop", headSha: developSha, baseRef: "main" }]
      },
      checks: {
        promotion: { state: "success", sha: developSha, required: { headSha: developSha } }
      }
    }
  });
  const plan = buildReadOnlyPlan(status);
  assert.equal(plan.nextAction.action, "review_current_promotion_pull_request");
  assert.match(plan.nextAction.reason, /PR #317/);
});

test("does not recommend merging a promotion PR whose head is older than develop", () => {
  const oldSha = "4".repeat(40);
  const status = validStatus({
    github: {
      pullRequests: {
        toMain: [{ number: 318, headRef: "develop", headSha: oldSha, baseRef: "main" }]
      },
      checks: { promotion: { state: "success", sha: oldSha, required: { headSha: oldSha } } }
    }
  });
  const plan = buildReadOnlyPlan(status);
  assert.equal(plan.nextAction.action, "synchronize_open_promotion_pull_request");
});

test("blocks planning when GitHub could not return a complete snapshot", () => {
  const plan = buildReadOnlyPlan(validStatus({ github: { state: "partial" } }));
  assert.ok(plan.blockers.includes("github_state_incomplete"));
  assert.equal(plan.mutationsEnabled, false);
});

test("publishes both read-only commands through the package scripts", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts["release:status"], "node scripts/release-coordinator.mjs status");
  assert.equal(pkg.scripts["release:plan"], "node scripts/release-coordinator.mjs plan");
});
