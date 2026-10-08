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
