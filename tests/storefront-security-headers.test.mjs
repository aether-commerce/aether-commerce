import assert from "node:assert/strict";
import test from "node:test";
import config from "../apps/storefront/next.config.mjs";

test("server-rendered storefront routes declare browser security headers", async () => {
  const rules = await config.headers();
  const catchAll = rules.find((rule) => rule.source === "/:path*");
  assert.ok(catchAll);
  const headers = Object.fromEntries(catchAll.headers.map(({ key, value }) => [key.toLowerCase(), value]));
  assert.match(headers["content-security-policy"], /default-src 'self'/);
  assert.match(headers["content-security-policy"], /object-src 'none'/);
  assert.match(headers["strict-transport-security"], /max-age=31536000/);
  assert.equal(headers["x-content-type-options"], "nosniff");
});

test("development policy permits only configured local API and assistant origins", async () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    apiUrl: process.env.NEXT_PUBLIC_AETHER_API_URL,
    aiUrl: process.env.NEXT_PUBLIC_AETHER_AI_URL
  };
  try {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_AETHER_API_URL = "http://127.0.0.1:8091";
    process.env.NEXT_PUBLIC_AETHER_AI_URL = "http://localhost:8090";
    const { default: devConfig } = await import("../apps/storefront/next.config.mjs?e2e-policy");
    const rules = await devConfig.headers();
    const policy = rules[0].headers.find(({ key }) => key === "Content-Security-Policy").value;
    assert.match(policy, /connect-src[^;]*http:\/\/127\.0\.0\.1:8091/);
    assert.match(policy, /connect-src[^;]*http:\/\/localhost:8090/);
    assert.doesNotMatch(policy, /upgrade-insecure-requests/);
  } finally {
    for (const [key, value] of [["NODE_ENV", previous.nodeEnv], ["NEXT_PUBLIC_AETHER_API_URL", previous.apiUrl],
      ["NEXT_PUBLIC_AETHER_AI_URL", previous.aiUrl]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
