import { getInventoryStatus, humanizeCategorySlug } from "@aether-commerce/core";
import { foldCatalogText, queryCatalog } from "@aether-commerce/api-core";
import { productSchema, type Product, type ProductQuery } from "@aether-commerce/schemas";
import type { Env } from "../types";
import { getStoreConfig } from "./store-config";

export type ProductDetails = {
  shortDescription: string;
  description: string;
  highlights: string[];
  specs: Record<string, string>;
  tags: string[];
  variants: Array<{ type: string; options: string[] }>;
  images: { main: string; gallery: string[] };
  imagePrompt?: string;
  // Optional admin overrides - normalizeRow falls back to a name/
  // shortDescription-derived default when either is absent, same behavior
  // as before these existed. Explicit `| undefined` (not just `?:`) because
  // exactOptionalPropertyTypes distinguishes "key absent" from "key present
  // with value undefined", and callers build this object from optional input.
  seoTitle?: string | undefined;
  seoDescription?: string | undefined;
};

export type ProductRow = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  final_price_cents: number;
  stock: number;
  low_stock_threshold: number;
  visibility: "draft" | "visible" | "hidden";
  featured: number;
  is_new: number;
  is_deal: number;
  rating_average: number;
  rating_count: number;
  details_json: string;
  created_at: string;
  updated_at: string;
  category_name?: string | undefined;
  store_category_id?: string | null | undefined;
  store_id?: string | undefined;
};

export const catalogCacheKey = "products-v2";
const storeId = (env: Env) => env.STORE_ID?.trim() || "store_default";
const memoryCacheTtlMs = 5 * 60 * 1000;
const memoryCatalogCache = new Map<string, { expiresAt: number; products: Product[] }>();

function storefrontOrigin(env: Env) {
  return env.APP_ORIGIN_STORE ?? "http://localhost:3000";
}

// Cloudinary/external image URLs already resolve on their own; only bare
// paths (the bundled demo catalog's /products/*.webp assets) need the
// storefront origin prefixed onto them.
function absoluteImageUrl(env: Env, imagePath: string) {
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const basePath = (env.APP_STORE_BASE_PATH ?? "").replace(/\/$/, "");
  return `${storefrontOrigin(env)}${basePath}${imagePath}`;
}

function flagsFor(row: ProductRow): Product["flags"] {
  const flags: Product["flags"] = [];
  if (row.featured) flags.push("featured");
  if (row.is_new) flags.push("new");
  if (row.is_deal) flags.push("deal");
  if (row.stock > 0 && row.stock <= row.low_stock_threshold) flags.push("limited");
  return flags.length > 0 ? flags : ["featured"];
}

function normalizeRow(env: Env, row: ProductRow, currency: "USD" | "COP" = "USD"): Product {
  const details = JSON.parse(row.details_json) as ProductDetails;
  const finalPrice = row.final_price_cents;
  const price = row.compare_at_price_cents ?? finalPrice;
  const discountPercentage = row.compare_at_price_cents
    ? Math.max(0, Math.min(95, Math.round((1 - finalPrice / row.compare_at_price_cents) * 100)))
    : 0;

  const categoryName = row.category_name || humanizeCategorySlug(row.category);
  const availableStock = Math.max(0, row.stock);
  const availabilityStatus = getInventoryStatus(availableStock, row.low_stock_threshold);

  const images: Product["images"] = [details.images.main, ...details.images.gallery].map((imagePath, index) => ({
    url: absoluteImageUrl(env, imagePath),
    alt: `${row.name} image ${index + 1}`,
    source: /^https?:\/\//i.test(imagePath) ? "cloudinary" : "local"
  }));

  const flags = flagsFor(row);
  const specifications = Object.entries(details.specs).map(([key, value]) => ({ key, value }));
  const primaryVariant = details.variants[0];

  return productSchema.parse({
    id: row.id,
    externalId: null,
    sourceId: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: details.shortDescription,
    description: details.description,
    price,
    originalPrice: row.compare_at_price_cents ? price : null,
    finalPrice,
    discountPercentage,
    currency,
    category: {
      id: row.category,
      externalId: null,
      slug: row.category,
      name: categoryName,
      image: images[0]?.url ?? null
    },
    sku: row.sku,
    brand: row.brand,
    tags: [row.category, row.subcategory, ...details.tags, ...flags].filter((tag): tag is string => Boolean(tag)),
    initialStock: availableStock,
    reservedStock: 0,
    soldStock: 0,
    returnedStock: 0,
    adjustedStock: 0,
    availableStock,
    availabilityStatus: availabilityStatus === "hidden" ? "discontinued" : availabilityStatus,
    thumbnail: images[0]?.url ?? absoluteImageUrl(env, details.images.main),
    images,
    gallery: images.map((image) => image.url),
    specifications,
    flags,
    seo: {
      title: details.seoTitle || `${row.name} | ${env.BRAND_NAME ?? "Aether"}`,
      description: details.seoDescription || details.shortDescription.slice(0, 150),
      canonicalPath: `/products/${row.slug}`
    },
    variants: primaryVariant
      ? primaryVariant.options.map((option, index) => ({
          id: `${row.slug}-${option.toLowerCase().replace(/\s+/g, "-")}`,
          name: primaryVariant.type,
          value: option,
          priceAdjustment: 0,
          stockAdjustment: 0,
          label: option,
          sku: `${row.sku}-${index + 1}`,
          priceDelta: 0,
          inventory: availableStock,
          attributes: { [primaryVariant.type]: option }
        }))
      : [],
    rating: {
      average: row.rating_average,
      count: row.rating_count
    },
    reviewCount: row.rating_count,
    reviews: [],
    inventory: {
      sku: row.sku,
      available: availableStock,
      reserved: 0,
      lowStockThreshold: row.low_stock_threshold,
      status: getInventoryStatus(availableStock, row.low_stock_threshold)
    },
    visibility: row.visibility,
    featured: flags.includes("featured"),
    newArrival: flags.includes("new"),
    deal: flags.includes("deal"),
    visible: row.visibility === "visible",
    seoTitle: details.seoTitle || `${row.name} | ${env.BRAND_NAME ?? "Aether"}`,
    seoDescription: details.seoDescription || details.shortDescription.slice(0, 150),
    catalogSource: "local",
    externalStock: null,
    lastSyncedAt: row.updated_at,
    shippingInformation: null,
    warrantyInformation: null,
    returnPolicy: null,
    minimumOrderQuantity: null,
    weight: null,
    dimensions: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

async function readAllRows(env: Env): Promise<ProductRow[]> {
  // The unscoped legacy read was: select * from products order by updated_at desc.
  const rows = await env.DB.prepare(
    "select p.*, c.name as category_name from products p left join store_categories c on c.id = p.store_category_id and c.store_id = p.store_id where p.store_id = ? order by p.updated_at desc"
  ).bind(storeId(env)).all<ProductRow>();
  return rows.results || [];
}

async function readCachedProducts(env: Env): Promise<Product[] | null> {
  const key = `${catalogCacheKey}:${storeId(env)}`;
  const memory = memoryCatalogCache.get(key);
  if (memory && memory.expiresAt > Date.now()) {
    return memory.products;
  }

  try {
    const row = await env.DB.prepare(
      "select payload_json from products_cache where id = ? and expires_at > datetime('now')"
    )
      .bind(key)
      .first<{ payload_json: string }>();
    if (!row) {
      return null;
    }
    const products = JSON.parse(row.payload_json) as Product[];
    memoryCatalogCache.set(key, { products, expiresAt: Date.now() + memoryCacheTtlMs });
    return products;
  } catch {
    return null;
  }
}

async function writeCachedProducts(env: Env, products: Product[]) {
  const key = `${catalogCacheKey}:${storeId(env)}`;
  try {
    await env.DB.prepare(
      `insert into products_cache (id, source, payload_json, expires_at, created_at, updated_at)
       values (?, 'local', ?, datetime('now', '+15 minutes'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       on conflict(id) do update set source = 'local', payload_json = excluded.payload_json, expires_at = excluded.expires_at, updated_at = CURRENT_TIMESTAMP`
    )
      .bind(key, JSON.stringify(products))
      .run();
    memoryCatalogCache.set(key, { products, expiresAt: Date.now() + memoryCacheTtlMs });
  } catch {
    // Cache failures should never block the storefront.
  }
}

// Cached set includes every row regardless of visibility - getCatalogSource
// filters to "visible" for the public-facing functions below, while
// products-admin.ts reads the table directly (bypassing this cache
// entirely) so admin management always sees drafts/hidden products and
// never a stale cached view of its own just-made edit.
async function getCatalogSource(env: Env): Promise<Product[]> {
  const { currency } = await getStoreConfig(env);
  const cached = await readCachedProducts(env);
  const all = cached ?? (await (async () => {
    const rows = await readAllRows(env);
    const products = rows.map((row) => normalizeRow(env, row, currency));
    await writeCachedProducts(env, products);
    return products;
  })());
  return all.filter((product) => product.visibility === "visible");
}

// Strips diacritics for accent-insensitive search (e.g. "camara" matches "cámara").
function foldText(value: string) {
  return foldCatalogText(value);
}

export async function getCatalogProducts(env: Env, query: ProductQuery) {
  return queryCatalog(await getCatalogSource(env), query);
}

export async function getProductBySlug(env: Env, slug: string) {
  const data = await getCatalogSource(env);
  return data.find((product) => product.slug === slug);
}

export async function getProductById(env: Env, id: string) {
  const data = await getCatalogSource(env);
  return data.find((product) => product.id === id || String(product.externalId) === id);
}

export async function getCategories(env: Env) {
  const rows = await env.DB.prepare(
    `select c.id, c.slug, c.name, min(p.details_json) as details_json
     from store_categories c left join products p on p.store_category_id = c.id and p.store_id = c.store_id and p.visibility = 'visible'
     where c.store_id = ? and c.is_hidden = 0
     group by c.id order by c.sort_order asc, c.name collate nocase asc`
  ).bind(storeId(env)).all<{ id: string; slug: string; name: string; details_json: string | null }>();
  return (rows.results ?? []).map((row) => {
    let image: string | null = null;
    if (row.details_json) {
      try { image = (JSON.parse(row.details_json) as { images?: { main?: string } }).images?.main ?? null; } catch { /* malformed product details are handled by the product path */ }
    }
    return { id: row.id, externalId: null, slug: row.slug, name: row.name, image: image ? absoluteImageUrl(env, image) : null };
  });
}

// One pass over the already-cached catalog source instead of one filtered
// query per category - lets callers show per-category counts (e.g. a
// category grid) without firing N separate requests.
export async function getCategoryCounts(env: Env) {
  const rows = await env.DB.prepare(
    `select c.slug, count(p.id) as count
     from store_categories c left join products p on p.store_category_id = c.id and p.store_id = c.store_id and p.visibility = 'visible'
     where c.store_id = ? and c.is_hidden = 0
     group by c.id order by c.sort_order asc, c.name collate nocase asc`
  ).bind(storeId(env)).all<{ slug: string; count: number }>();
  return rows.results ?? [];
}

export async function clearCatalogCache(env: Env) {
  const key = `${catalogCacheKey}:${storeId(env)}`;
  memoryCatalogCache.delete(key);
  try {
    await env.DB.prepare("delete from products_cache where id = ?").bind(key).run();
  } catch {
    // Best-effort - a stale cache row just means a slower next read, not a failure.
  }
}

export async function getBrands(env: Env) {
  const data = await getCatalogSource(env);
  const brands = new Set<string>();
  data.forEach((product) => {
    if (product.brand) {
      brands.add(product.brand);
    }
  });
  return [...brands].sort((a, b) => a.localeCompare(b));
}

// Exported for characterization tests only - not part of the public catalog API surface.
export const __testables = {
  normalizeRow,
  flagsFor,
  foldText,
  readAllRows
};
