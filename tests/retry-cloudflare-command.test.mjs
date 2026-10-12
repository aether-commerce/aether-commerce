import assert from "node:assert/strict";
import { test } from "node:test";
import { isRetryableCloudflareFailure, retryCloudflareCommand } from "../scripts/retry-cloudflare-command.mjs";

test("retries Cloudflare gateway failures and then succeeds", async () => {
  const outputs = [
    { exitCode: 1, output: "POST /accounts/example/workers/scripts/api/versions -> 504 Gateway Timeout" },
    { exitCode: 1, output: "GET /accounts/example/workers/services/api -> 503 Service Unavailable" },
    { exitCode: 0, output: "Deployed" }
  ];
  const delays = [];
  const messages = [];
  const result = await retryCloudflareCommand(() => Promise.resolve(outputs.shift()), {
    wait: async (delay) => { delays.push(delay); },
    log: (message) => { messages.push(message); }
  });

  assert.equal(result, 0);
  assert.deepEqual(delays, [15_000, 30_000]);
  assert.equal(messages.length, 2);
});

test("does not retry credentials or configuration failures", async () => {
  let calls = 0;
  const result = await retryCloudflareCommand(async () => {
    calls += 1;
    return { exitCode: 1, output: "Authentication error [code: 10000]" };
  }, { wait: async () => { throw new Error("unexpected delay"); } });

  assert.equal(result, 1);
  assert.equal(calls, 1);
  assert.equal(isRetryableCloudflareFailure("POST /versions -> 400 Bad Request"), false);
  assert.equal(isRetryableCloudflareFailure("GET /worker -> 504 Gateway Timeout\nPOST /worker -> 400 Bad Request"), false);
});

test("stops after the third gateway failure", async () => {
  let calls = 0;
  const result = await retryCloudflareCommand(async () => {
    calls += 1;
    return { exitCode: 1, output: "PATCH /workers/scripts/api/secrets-bulk -> 504 Gateway Timeout" };
  }, { wait: async () => {}, log: () => {} });

  assert.equal(result, 1);
  assert.equal(calls, 3);
});
