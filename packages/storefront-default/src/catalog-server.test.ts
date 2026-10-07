import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@aether-commerce/schemas";
import { fetchAllCatalogProducts, fetchCatalogCategoryBySlug } from "./catalog-server";
import { fetchProductBySlug } from "./product-detail-server";
import { buildStorefrontSitemap } from "./sitemap-server";

afterEach(() => vi.unstubAllGlobals());
const product = {
  slug: "red-bat",
  visible: true,
  visibility: "visible",
  flags: [],
  category: { slug: "gargantillas" },
  seo: { canonicalPath: "/products/red-bat" },
  updatedAt: "2026-10-07T10:00:00Z"
} as unknown as Product;
const categories = [
  { slug: "gargantillas", name: "Gargantillas" },
  { slug: "empty", name: "Empty" }
];

describe("server catalog reads and sitemap", () => {
  it("returns the real category name and distinguishes missing categories from API outages", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(Response.json({ success: true, data: categories }))
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchCatalogCategoryBySlug("https://api.example", "gargantillas")).toEqual({
      status: "found",
      category: categories[0]
    });
    expect(await fetchCatalogCategoryBySlug("https://api.example", "missing")).toEqual({
      status: "not-found"
    });
    fetcher.mockResolvedValue(new Response("unavailable", { status: 503 }));
    expect(await fetchCatalogCategoryBySlug("https://api.example", "gargantillas")).toEqual({
      status: "unavailable"
    });
  });
  it("recognizes a missing product even when the API 404 body is not JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("Not found", { status: 404 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchProductBySlug("https://api.example", "missing")).toEqual({
      status: "not-found"
    });
    fetcher.mockResolvedValue(new Response("Bad gateway", { status: 502 }));
    expect(await fetchProductBySlug("https://api.example", "red-bat")).toEqual({
      status: "unavailable"
    });
  });
  it("does not publish a partial catalog when a later page fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            success: true,
            data: [product],
            pagination: { page: 1, pageSize: 50, total: 51, pageCount: 2 }
          })
        )
        .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
    );
    expect(await fetchAllCatalogProducts("https://api.example")).toBeNull();
  });
  it("builds canonical sitemap URLs only for visible products and populated categories", async () => {
    const hidden = {
      ...product,
      slug: "hidden",
      visible: false,
      seo: { canonicalPath: "/products/hidden" }
    };
    const draft = {
      ...product,
      slug: "draft",
      visibility: "draft",
      seo: { canonicalPath: "/products/draft" }
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          Response.json({
            success: true,
            data: url.includes("/categories") ? categories : [product, product, hidden, draft]
          })
        )
      )
    );
    const sitemap = await buildStorefrontSitemap({
      apiBaseUrl: "https://api.example",
      siteUrl: "https://shop.example",
      basePath: "/store",
      staticPaths: ["/", "/"]
    });
    expect(sitemap.map((entry) => entry.url)).toEqual([
      "https://shop.example/store/",
      "https://shop.example/store/categories/gargantillas/",
      "https://shop.example/store/products/red-bat/"
    ]);
    expect(sitemap[2]?.lastModified).toBe(product.updatedAt);
  });
  it("fails sitemap generation rather than caching an empty catalog during an outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(
      buildStorefrontSitemap({ apiBaseUrl: "https://api.example", siteUrl: "https://shop.example" })
    ).rejects.toThrow("Catalog unavailable");
  });
});
