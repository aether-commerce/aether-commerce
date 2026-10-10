import assert from "node:assert/strict";
import test from "node:test";
import { checkPublicCatalog } from "../scripts/check-public-catalog.mjs";

const product = { slug: "funda-slim-grip", updatedAt: "2026-10-10T00:41:10.000Z" };

test("catalog smoke check accepts a visible product with an ISO timestamp", async () => {
  const fetcher = async (url) => {
    assert.equal(url.pathname, "/api/v1/catalog/products");
    assert.equal(url.searchParams.get("pageSize"), "1");
    return Response.json({ success: true, data: [product], pagination: { total: 200 } });
  };
  assert.deepEqual(await checkPublicCatalog("https://api.example", fetcher), { total: 200, slug: product.slug });
});

test("catalog smoke check fails on the production outage and an empty response", async () => {
  await assert.rejects(
    checkPublicCatalog("https://api.example", async () => new Response("unavailable", { status: 500 })),
    /HTTP 500/
  );
  await assert.rejects(
    checkPublicCatalog("https://api.example", async () => Response.json({ success: true, data: [], pagination: { total: 0 } })),
    /visible product/
  );
  await assert.rejects(
    checkPublicCatalog("https://api.example", async () => Response.json({ success: true, data: [{ ...product, updatedAt: "2026-10-10 00:41:10" }], pagination: { total: 1 } })),
    /non-ISO/
  );
});
