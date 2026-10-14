import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import type { Product } from "@aether-commerce/schemas";
import type { Env } from "../packages/api-worker/src/types";
import { getCatalogProducts, getProductById, getProductBySlug } from "../packages/api-worker/src/services/catalog";
import { catalogRoutes } from "../packages/api-worker/src/routes/catalog";
import { publicRoutes } from "../packages/api-worker/src/routes/public";

const requireApiWorker = createRequire(new URL("../packages/api-worker/package.json", import.meta.url));
const { Hono } = requireApiWorker("hono");

vi.mock("../packages/api-worker/src/services/catalog", () => ({
  getCatalogProducts: vi.fn(),
  getProductById: vi.fn(),
  getProductBySlug: vi.fn(),
  getBrands: vi.fn(),
  getCategories: vi.fn(),
  getCategoryCounts: vi.fn()
}));

const image = "https://res.cloudinary.com/demo/image/upload/v1/ring.jpg";
const product = {
  id: "ring",
  slug: "ring",
  thumbnail: image,
  images: [{ url: image, alt: "Ring", source: "cloudinary" }],
  gallery: [image],
  category: { image }
} as Product;
const pagination = { page: 1, pageSize: 12, total: 1, pageCount: 1 };
const app = new Hono().route("/catalog", catalogRoutes).route("/public", publicRoutes);

beforeEach(() => {
  vi.mocked(getCatalogProducts).mockResolvedValue({ data: [product], pagination });
  vi.mocked(getProductById).mockResolvedValue(product);
  vi.mocked(getProductBySlug).mockResolvedValue(product);
});

describe("mutable public catalog response caching", () => {
  it.each(["/catalog/products", "/public/products"])(
    "forces fresh edge/browser validation at %s",
    async (path) => {
      const response = await app.request(path, {}, {} as Env);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=0, s-maxage=0, must-revalidate"
      );
    }
  );
});
