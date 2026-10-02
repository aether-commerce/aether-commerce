import { describe, expect, it } from "vitest";
import { getProductImageUrl, withStorefrontProductImages } from "./product-images";
import type { Product } from "@aether-commerce/schemas";

const original = "https://res.cloudinary.com/liminal/image/upload/v123/products/ring.jpg";

describe("product image delivery", () => {
  it("keeps the asset identity and query while negotiating a bounded image", () => {
    expect(getProductImageUrl(`${original}?v=2`, 480)).toBe("https://res.cloudinary.com/liminal/image/upload/c_limit,w_480,q_auto,f_auto/v123/products/ring.jpg?v=2");
  });
  it("replaces its own resize when a thumbnail is rendered at detail resolution", () => {
    expect(getProductImageUrl(getProductImageUrl(original, 640), 1600)).toBe(getProductImageUrl(original, 1600));
  });
  it("preserves existing crops before the final delivery resize", () => {
    const src = original.replace("/upload/", "/upload/c_crop,w_2000,h_2000/g_center/");
    expect(getProductImageUrl(src, 480)).toContain("/c_crop,w_2000,h_2000/g_center/c_limit,w_480,q_auto,f_auto/v123/");
  });
  it("supports unversioned assets and encoded paths", () => {
    expect(getProductImageUrl("https://res.cloudinary.com/demo/image/upload/products/ring%20one.jpg", 480)).toContain("/c_limit,w_480,q_auto,f_auto/products/ring%20one.jpg");
  });
  it.each([
    "/products/ring.webp", "https://images.unsplash.com/ring.jpg", "bad-url",
    "https://res.cloudinary.com.attacker.test/demo/image/upload/ring.jpg",
    "https://res.cloudinary.com/demo/image/authenticated/ring.jpg",
    "https://res.cloudinary.com/demo/image/upload/s--signature--/v123/ring.jpg",
    `${original}?__cld_token__=signed`, original.replace(".jpg", ".gif"), original.replace(".jpg", ".svg")
  ])("keeps unsupported or signed sources unchanged: %s", (src) => {
    expect(getProductImageUrl(src, 480)).toBe(src);
  });
  it("bounds requested dimensions and rejects invalid widths", () => {
    expect(getProductImageUrl(original, 10000)).toContain("w_2560");
    expect(getProductImageUrl(original, Number.NaN)).toBe(original);
    expect(getProductImageUrl(original, 0)).toBe(original);
  });
  it("returns a presentation copy and preserves originals used by administration", () => {
    const product = { thumbnail: original, images: [{ url: original, alt: "Ring", source: "cloudinary" }], gallery: [original], category: { image: original } } as Product;
    const result = withStorefrontProductImages(product);
    expect(result.thumbnail).toContain("w_640");
    expect(result.images[0]?.url).toContain("w_1600");
    expect(result.gallery[0]).toContain("w_1600");
    expect(result.category.image).toContain("w_640");
    expect(product.images[0]?.url).toBe(original);
    expect(product.thumbnail).toBe(original);
    expect(withStorefrontProductImages(result)).toEqual(result);
  });
});
