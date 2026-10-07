import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogRequestStatus } from "./catalog-request";
afterEach(() => vi.unstubAllGlobals());
describe("catalog status before streaming", () => {
  it("skips assets and catalog list pages without an API lookup", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await catalogRequestStatus("https://api.example", "/products/")).toBe(200);
    expect(await catalogRequestStatus("https://api.example", "/_next/static/main.js")).toBe(200);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves 404 for missing slugs and 503 for temporary failures", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response("Not found", { status: 404 })));
    vi.stubGlobal("fetch", fetcher);
    expect(
      await catalogRequestStatus("https://api.example", "/shop/products/missing/", "/shop")
    ).toBe(404);
    fetcher.mockImplementation(() => Promise.resolve(new Response("Unavailable", { status: 503 })));
    expect(await catalogRequestStatus("https://api.example", "/categories/real/")).toBe(503);
  });
  it("returns 200 only for an existing category entity", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            Response.json({ success: true, data: [{ slug: "test", name: "Collares" }] })
          )
        )
    );
    expect(await catalogRequestStatus("https://api.example", "/categories/test/")).toBe(200);
    expect(await catalogRequestStatus("https://api.example", "/categories/missing/")).toBe(404);
  });
});
