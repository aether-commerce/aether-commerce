import { describe, expect, it } from "vitest";
import type { Product } from "@aether-commerce/schemas";
import { queryCatalog } from "./catalog";

function heroProduct(id: string, featuredOrder: number | null, rating: number): Product {
  return {
    id,
    externalId: null,
    sourceId: id,
    slug: id,
    name: id,
    shortDescription: id,
    description: id,
    price: 100,
    originalPrice: null,
    finalPrice: 100,
    discountPercentage: 0,
    currency: "USD",
    category: { id: "category", externalId: null, slug: "category", name: "Category", image: null },
    sku: id,
    brand: null,
    tags: [],
    initialStock: 10,
    reservedStock: 0,
    soldStock: 0,
    returnedStock: 0,
    adjustedStock: 0,
    availableStock: 10,
    availabilityStatus: "in_stock",
    thumbnail: "https://example.com/image.jpg",
    images: [{ url: "https://example.com/image.jpg", alt: id, source: "fallback" }],
    gallery: ["https://example.com/image.jpg"],
    specifications: [],
    flags: ["featured"],
    seo: { title: id, description: id, canonicalPath: `/${id}` },
    variants: [],
    rating: { average: rating, count: 1 },
    reviewCount: 1,
    reviews: [],
    inventory: { sku: id, available: 10, reserved: 0, lowStockThreshold: 4, status: "in_stock" },
    visibility: "visible",
    featured: true,
    featuredOrder,
    newArrival: false,
    deal: false,
    visible: true,
    seoTitle: null,
    seoDescription: null,
    catalogSource: "local",
    externalStock: null,
    lastSyncedAt: "2025-01-01T00:00:00.000Z",
    shippingInformation: null,
    warrantyInformation: null,
    returnPolicy: null,
    minimumOrderQuantity: null,
    weight: null,
    dimensions: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z"
  };
}

describe("queryCatalog featured ordering", () => {
  it("places manually positioned hero products before automatic fallbacks", () => {
    const result = queryCatalog(
      [heroProduct("automatic-high", null, 5), heroProduct("slot-2", 2, 1), heroProduct("slot-1", 1, 1)],
      { page: 1, pageSize: 4, featured: true, sort: "featured" }
    );

    expect(result.data.map((product) => product.id)).toEqual(["slot-1", "slot-2", "automatic-high"]);
  });
});
