import { createServer } from "node:http";

// Browser route mocks cannot intercept the new server-side catalog reads.
const category = {
  id: "smartphones",
  externalId: null,
  slug: "smartphones",
  name: "Smartphones",
  image: null
};
const image = "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80";
const timestamp = "2026-01-01T00:00:00.000Z";
const product = {
  id: "funda-slim-grip",
  externalId: null,
  sourceId: "e2e",
  slug: "funda-slim-grip",
  name: "Funda Slim Grip",
  shortDescription: "A slim phone case.",
  description: "A slim phone case for the catalog test.",
  price: 1900,
  originalPrice: null,
  finalPrice: 1900,
  discountPercentage: 0,
  currency: "USD",
  category,
  sku: "E2E-CASE",
  brand: null,
  tags: [],
  initialStock: 10,
  reservedStock: 0,
  soldStock: 0,
  returnedStock: 0,
  adjustedStock: 0,
  availableStock: 10,
  availabilityStatus: "in_stock",
  thumbnail: image,
  images: [{ url: image, alt: "Funda Slim Grip", source: "fallback" }],
  gallery: [image],
  specifications: [],
  flags: [],
  seo: {
    title: "Funda Slim Grip",
    description: "A slim phone case.",
    canonicalPath: "/products/funda-slim-grip"
  },
  variants: [],
  rating: { average: 0, count: 0 },
  reviewCount: 0,
  reviews: [],
  inventory: {
    sku: "E2E-CASE",
    available: 10,
    reserved: 0,
    lowStockThreshold: 2,
    status: "in_stock"
  },
  visibility: "visible",
  featured: false,
  newArrival: false,
  deal: false,
  visible: true,
  seoTitle: null,
  seoDescription: null,
  catalogSource: "local",
  externalStock: null,
  lastSyncedAt: timestamp,
  shippingInformation: null,
  warrantyInformation: null,
  returnPolicy: null,
  minimumOrderQuantity: null,
  weight: null,
  dimensions: null,
  createdAt: timestamp,
  updatedAt: timestamp
};

createServer((request, response) => {
  const url = new URL(request.url, "http://localhost:8091");
  response.setHeader("access-control-allow-origin", "http://localhost:3010");
  response.setHeader("content-type", "application/json");
  const send = (data, extra = {}) =>
    response.end(JSON.stringify({ success: true, data, ...extra }));
  if (url.pathname === "/health") return send({ status: "ok" });
  if (url.pathname === "/api/v1/catalog/categories") return send([category]);
  if (url.pathname === "/api/v1/catalog/brands") return send([]);
  if (url.pathname === "/api/v1/catalog/products") {
    return send([product], { pagination: { page: 1, pageSize: 12, total: 1, pageCount: 1 } });
  }
  if (url.pathname === "/api/v1/products/slug/funda-slim-grip") return send(product);
  response.statusCode = 404;
  response.end(JSON.stringify({ success: false, error: { code: "NOT_FOUND" } }));
}).listen(8091, "127.0.0.1");
