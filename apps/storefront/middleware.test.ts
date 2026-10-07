import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { catalogRequestStatus } from "@aether-commerce/storefront-default/server";
import { middleware } from "./middleware";
vi.mock("@aether-commerce/storefront-default/server", () => ({ catalogRequestStatus: vi.fn() }));
vi.mock("./components/config", () => ({
  apiBaseUrl: "https://api.example",
  storefrontBasePath: ""
}));
beforeEach(() => vi.resetAllMocks());
describe("storefront HTTP status guard", () => {
  it("preserves the legacy product redirect without looking up detail as a slug", async () => {
    const response = await middleware(
      new NextRequest("https://shop.example/products/detail/?slug=red-bat")
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(catalogRequestStatus).not.toHaveBeenCalled();
  });
  it("rewrites missing products to the merchant 404 UI with a real 404", async () => {
    vi.mocked(catalogRequestStatus).mockResolvedValue(404);
    const response = await middleware(new NextRequest("https://shop.example/products/missing/"));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://shop.example/404/");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
  });
  it("returns a retryable 503 rather than a false missing-product response", async () => {
    vi.mocked(catalogRequestStatus).mockResolvedValue(503);
    const response = await middleware(new NextRequest("https://shop.example/products/red-bat/"));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://shop.example/catalog-unavailable/"
    );
  });
});
