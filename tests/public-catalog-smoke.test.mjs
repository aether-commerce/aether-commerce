import assert from "node:assert/strict";
import test from "node:test";
import { checkPublicCatalog } from "../scripts/check-public-catalog.mjs";

const product = {
  slug: "funda-slim-grip",
  name: "Funda Slim Grip",
  shortDescription: "Funda protectora para el uso diario.",
  description: "Protección ligera con buen agarre.",
  price: 8900000,
  finalPrice: 8900000,
  currency: "COP",
  category: { slug: "accesorios" },
  images: [{ url: "https://cdn.example.test/funda.webp" }],
  updatedAt: "2026-10-10T00:41:10.000Z"
};

test("catalog smoke check accepts a visible product with an ISO timestamp", async () => {
  const fetcher = async (url) => {
    assert.equal(url.pathname, "/api/v1/catalog/products");
    assert.equal(url.searchParams.get("pageSize"), "5");
    return Response.json({ success: true, data: [product], pagination: { total: 200 } });
  };
  assert.deepEqual(await checkPublicCatalog("https://api.example", fetcher), {
    total: 200,
    checked: 1,
    sample: {
      slug: product.slug,
      name: product.name,
      price: product.price,
      currency: product.currency
    }
  });
});

test("catalog smoke check fails on the production outage and an empty response", async () => {
  await assert.rejects(
    checkPublicCatalog(
      "https://api.example",
      async () => new Response("unavailable", { status: 500 })
    ),
    /HTTP 500/
  );
  await assert.rejects(
    checkPublicCatalog("https://api.example", async () =>
      Response.json({ success: true, data: [], pagination: { total: 0 } })
    ),
    /consistent, non-empty product page/
  );
  await assert.rejects(
    checkPublicCatalog("https://api.example", async () =>
      Response.json({
        success: true,
        data: [{ ...product, updatedAt: "2026-10-10 00:41:10" }],
        pagination: { total: 1 }
      })
    ),
    /non-ISO/
  );
  await assert.rejects(
    checkPublicCatalog("https://api.example", async () =>
      Response.json({
        success: true,
        data: [{ ...product, price: null }],
        pagination: { total: 1 }
      })
    ),
    /missing display, category, image, or price content/
  );
});
