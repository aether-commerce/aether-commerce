import assert from "node:assert/strict";
import test from "node:test";
import { checkDeploymentSmoke } from "../scripts/check-deployment-smoke.mjs";
import {
  createDeployBuildInfo,
  writeDeployBuildInfo
} from "../scripts/write-deploy-build-info.mjs";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const revision = "d".repeat(40);
const config = {
  environment: "production",
  expectedRevision: revision,
  storefrontUrl: "https://store.example.test",
  apiUrl: "https://api.example.test",
  assistantUrl: "https://ai.example.test",
  adminUrl: "https://admin.example.test",
  portfolioUrl: "https://portfolio.example.test"
};

function html() {
  return new Response(
    "<!doctype html><html><head><title>Aether</title></head><body>Store is ready</body></html>",
    {
      headers: { "content-type": "text/html; charset=utf-8" }
    }
  );
}

function json(value) {
  return Response.json(value);
}

function makeFetcher({
  apiRevision = revision,
  assistantRevision = revision,
  storefrontRevision = revision,
  adminRevision = revision
} = {}) {
  return async (input) => {
    const url = new URL(input);
    if (
      ["store.example.test", "admin.example.test", "portfolio.example.test"].includes(
        url.hostname
      ) &&
      url.pathname === "/"
    )
      return html();
    if (url.hostname === "store.example.test" && url.pathname === "/build-info.json") {
      return json({
        schemaVersion: 1,
        service: "aether-storefront",
        environment: "production",
        revision: storefrontRevision
      });
    }
    if (url.hostname === "admin.example.test" && url.pathname === "/build-info.json") {
      return json({
        schemaVersion: 1,
        service: "aether-admin",
        environment: "production",
        revision: adminRevision
      });
    }
    if (url.hostname === "api.example.test" && url.pathname === "/api/v1/health/ready") {
      return json({ success: true, data: { status: "ok", revision: apiRevision } });
    }
    if (url.hostname === "ai.example.test" && url.pathname === "/healthz") {
      return json({ status: "ok", service: "aether-ai", revision: assistantRevision });
    }
    if (url.hostname === "ai.example.test" && url.pathname === "/readyz")
      return json({ status: "ready" });
    throw new Error(`Unexpected smoke URL: ${url.href}`);
  };
}

test("deployment smoke verifies healthy services and exact revisions", async () => {
  const result = await checkDeploymentSmoke(config, makeFetcher(), {
    attempts: 1,
    retryDelayMs: 0
  });
  assert.equal(result.status, "verified");
  assert.equal(result.expectedRevision, revision);
  assert.equal(result.services.api.revision, revision);
  assert.equal(result.services.assistant.revision, revision);
  assert.equal(result.services.portfolio.revision, "independent-service");
});

test("deployment smoke rejects an HTTP 200 service that serves the wrong revision", async () => {
  await assert.rejects(
    checkDeploymentSmoke(config, makeFetcher({ apiRevision: "e".repeat(40) }), {
      attempts: 1,
      retryDelayMs: 0
    }),
    /API serves revision/
  );
});

test("deployment smoke retries a temporarily missing build metadata asset", async () => {
  let missingMetadataCount = 0;
  const fetcher = async (input, options) => {
    const url = new URL(input);
    if (url.hostname === "store.example.test" && url.pathname === "/build-info.json" && missingMetadataCount === 0) {
      missingMetadataCount += 1;
      return new Response("Not deployed yet", { status: 404 });
    }
    return makeFetcher()(input, options);
  };
  const result = await checkDeploymentSmoke(config, fetcher, { attempts: 2, retryDelayMs: 0 });
  assert.equal(result.status, "verified");
  assert.equal(missingMetadataCount, 1);
});

test("deployment smoke retries stale API and assistant revisions and still requires the exact SHA", async () => {
  let apiCalls = 0, assistantCalls = 0;
  const fetcher = async (input, options) => {
    const url = new URL(input);
    if (url.hostname === "api.example.test" && url.pathname === "/api/v1/health/ready") {
      apiCalls += 1;
      return json({ success: true, data: { status: "ok", revision: apiCalls === 1 ? "e".repeat(40) : revision } });
    }
    if (url.hostname === "ai.example.test" && url.pathname === "/healthz") {
      assistantCalls += 1;
      return json({ status: "ok", service: "aether-ai", revision: assistantCalls === 1 ? "e".repeat(40) : revision });
    }
    return makeFetcher()(input, options);
  };
  const result = await checkDeploymentSmoke(config, fetcher, { attempts: 2, retryDelayMs: 0 });
  assert.equal(result.status, "verified");
  assert.equal(apiCalls, 2);
  assert.equal(assistantCalls, 2);
  await assert.rejects(checkDeploymentSmoke(config, makeFetcher({ apiRevision: "e".repeat(40) }), {
    attempts: 2, retryDelayMs: 0
  }), /API serves revision/);
});

test("deployment smoke rejects an unready assistant", async () => {
  const fetcher = async (input) => {
    const url = new URL(input);
    if (url.hostname === "ai.example.test" && url.pathname === "/readyz")
      return json({ status: "disabled" });
    return makeFetcher()(input);
  };
  await assert.rejects(
    checkDeploymentSmoke(config, fetcher, { attempts: 1, retryDelayMs: 0 }),
    /Assistant readiness reported disabled/
  );
});

test("build metadata accepts only known services, environments, and full revisions", () => {
  assert.deepEqual(createDeployBuildInfo("storefront", "development", revision), {
    schemaVersion: 1,
    service: "aether-storefront",
    environment: "development",
    revision
  });
  assert.throws(
    () => createDeployBuildInfo("portfolio", "production", revision),
    /Unknown deployment service/
  );
  assert.throws(
    () => createDeployBuildInfo("admin", "staging", revision),
    /must be development or production/
  );
  assert.throws(() => createDeployBuildInfo("admin", "production", "abc"), /full 40-character/);
});

test("build metadata writes only the fixed artifact paths", () => {
  const root = mkdtempSync(join(tmpdir(), "aether-build-info-"));
  try {
    const result = writeDeployBuildInfo("admin", { root, environment: "development", revision });
    assert.equal(result.service, "aether-admin");
    assert.deepEqual(JSON.parse(readFileSync(result.path, "utf8")), {
      schemaVersion: 1,
      service: "aether-admin",
      environment: "development",
      revision
    });
    assert.match(result.path, /apps[\\/]admin[\\/]out[\\/]build-info\.json$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
