import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export async function checkPublicCatalog(apiBaseUrl, fetcher = fetch) {
  if (!apiBaseUrl)
    throw new Error("NEXT_PUBLIC_AETHER_API_URL is required for the catalog smoke check.");
  const url = new URL("/api/v1/catalog/products?page=1&pageSize=5", apiBaseUrl);
  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Public catalog returned HTTP ${response.status}.`);

  const payload = await response.json();
  const products = payload.data;
  const sample = products?.[0];
  const total = payload.pagination?.total;
  if (
    payload.success !== true ||
    !Array.isArray(products) ||
    products.length < 1 ||
    !Number.isInteger(total) ||
    total < products.length
  ) {
    throw new Error("Public catalog did not return a consistent, non-empty product page.");
  }

  for (const product of products) {
    if (
      typeof product?.slug !== "string" ||
      !product.slug.trim() ||
      typeof product.name !== "string" ||
      !product.name.trim() ||
      typeof product.shortDescription !== "string" ||
      !product.shortDescription.trim() ||
      typeof product.description !== "string" ||
      !product.description.trim() ||
      !Number.isSafeInteger(product.price) ||
      product.price < 0 ||
      !Number.isSafeInteger(product.finalPrice) ||
      product.finalPrice < 0 ||
      typeof product.currency !== "string" ||
      !/^[A-Z]{3}$/.test(product.currency) ||
      typeof product.category?.slug !== "string" ||
      !product.category.slug.trim() ||
      !Array.isArray(product.images) ||
      product.images.length < 1 ||
      typeof product.images[0]?.url !== "string" ||
      !product.images[0].url.trim()
    ) {
      throw new Error(
        "Public catalog returned a product with missing display, category, image, or price content."
      );
    }
    if (
      typeof product.updatedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(product.updatedAt)
    ) {
      throw new Error("Public catalog returned a product with a non-ISO update timestamp.");
    }
  }
  return {
    total,
    checked: products.length,
    sample: {
      slug: sample.slug,
      name: sample.name,
      price: sample.price,
      currency: sample.currency
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await checkPublicCatalog(process.env.NEXT_PUBLIC_AETHER_API_URL);
      console.log(JSON.stringify({ status: "verified", ...result }));
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(3000);
    }
  }
  if (lastError) {
    console.error(lastError instanceof Error ? lastError.message : String(lastError));
    process.exitCode = 1;
  }
}
