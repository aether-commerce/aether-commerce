import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Product } from "@aether-commerce/schemas";
import type { AppBindings, Env } from "../types";
import { catalogRoutes } from "./catalog";
import { publicRoutes } from "./public";
import { getCatalogProducts, getProductById, getProductBySlug } from "../services/catalog";

vi.mock("../services/catalog", () => ({
  getCatalogProducts: vi.fn(), getProductById: vi.fn(), getProductBySlug: vi.fn(),
  getBrands: vi.fn(), getCategories: vi.fn(), getCategoryCounts: vi.fn()
}));

const src = "https://res.cloudinary.com/demo/image/upload/v1/ring.jpg";
const product = { id: "ring", slug: "ring", thumbnail: src, images: [{ url: src, alt: "Ring", source: "cloudinary" }], gallery: [src], category: { image: src } } as Product;
const pagination = { page: 1, pageSize: 12, total: 1, pageCount: 1 };
const app = new Hono<AppBindings>().route("/catalog", catalogRoutes).route("/public", publicRoutes);

beforeEach(() => {
  vi.mocked(getCatalogProducts).mockResolvedValue({ data: [product], pagination });
  vi.mocked(getProductById).mockResolvedValue(product);
  vi.mocked(getProductBySlug).mockResolvedValue(product);
});

describe("public product image responses", () => {
  it.each(["/catalog/products", "/public/products", "/public/categories/jewelry/products", "/public/search?q=ring", "/public/featured-products", "/public/deals", "/public/new-arrivals"])("bounds images at %s without changing cached originals", async (path) => {
    const response = await app.request(path, {}, {} as Env);
    const payload: { data: Product[]; pagination: typeof pagination } = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data[0]?.thumbnail).toContain("w_640,q_auto,f_auto");
    expect(payload.data[0]?.images[0]?.url).toContain("w_1600,q_auto,f_auto");
    expect(payload.pagination.total).toBe(1);
    expect(product.thumbnail).toBe(src);
  });
  it.each(["/catalog/products/ring", "/public/products/ring", "/public/products/slug/ring"])("delivers a detail variant at %s", async (path) => {
    const response = await app.request(path, {}, {} as Env);
    const payload: { data: Product } = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.gallery[0]).toContain("w_1600,q_auto,f_auto");
  });
  it("keeps not-found responses intact", async () => {
    vi.mocked(getProductBySlug).mockResolvedValue(undefined);
    expect((await app.request("/catalog/products/missing", {}, {} as Env)).status).toBe(404);
  });
});
