import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export async function checkPublicCatalog(apiBaseUrl, fetcher = fetch) {
  if (!apiBaseUrl) throw new Error("NEXT_PUBLIC_AETHER_API_URL is required for the catalog smoke check.");
  const url = new URL("/api/v1/catalog/products?page=1&pageSize=1", apiBaseUrl);
  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Public catalog returned HTTP ${response.status}.`);

  const payload = await response.json();
  const sample = payload.data?.[0];
  const total = payload.pagination?.total;
  if (payload.success !== true || !Array.isArray(payload.data) || !Number.isInteger(total) || total < 1 || !sample?.slug) {
    throw new Error("Public catalog did not return a visible product.");
  }
  if (typeof sample.updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(sample.updatedAt)) {
    throw new Error("Public catalog returned a product with a non-ISO update timestamp.");
  }
  return { total, slug: sample.slug };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { total, slug } = await checkPublicCatalog(process.env.NEXT_PUBLIC_AETHER_API_URL);
      console.log(`catalog_ok total=${total} sample=${slug}`);
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
