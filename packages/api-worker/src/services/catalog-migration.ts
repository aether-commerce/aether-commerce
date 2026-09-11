import { productWriteSchemaValidated, normalizeProductWriteInput } from "@aether-commerce/schemas";
import type { Env } from "../types";
import { clearCatalogCache, type ProductDetails, type ProductRow } from "./catalog";
import { uploadCloudinaryProductImage } from "./cloudinary";

const storeId = (env: Env) => env.STORE_ID?.trim() || "store_default";

export type CatalogMigrationOptions = {
  dryRun: boolean;
  limit?: number | undefined;
  afterId?: string | undefined;
};

export type CatalogMigrationReport = {
  storeId: string;
  scanned: number;
  migrated: number;
  unchanged: number;
  errors: Array<{ productId: string; message: string }>;
  nextCursor: string | null;
};

function isCloudinaryUrl(value: string) {
  return /^https:\/\/res\.cloudinary\.com\//i.test(value);
}

function legacyImageUrl(env: Env, value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  const origin = (env.APP_ORIGIN_STORE ?? "http://localhost:3000").replace(/\/$/, "");
  const basePath = (env.APP_STORE_BASE_PATH ?? "").replace(/\/$/, "");
  return `${origin}${basePath}${value.startsWith("/") ? value : `/${value}`}`;
}

function canonicalDetails(row: ProductRow) {
  let details: Partial<ProductDetails>;
  try {
    details = JSON.parse(row.details_json) as Partial<ProductDetails>;
  } catch {
    throw new Error("details_json is not valid JSON");
  }

  const candidate = productWriteSchemaValidated.safeParse({
    name: row.name,
    category: row.category,
    subcategory: row.subcategory,
    shortDescription: details.shortDescription ?? row.name,
    description: details.description ?? row.name,
    highlights: details.highlights ?? [],
    specs: details.specs ?? {},
    tags: details.tags ?? [],
    variants: details.variants ?? [],
    images: details.images,
    seoTitle: details.seoTitle,
    seoDescription: details.seoDescription,
    priceCents: row.final_price_cents,
    compareAtPriceCents: row.compare_at_price_cents,
    stock: row.stock,
    lowStockThreshold: row.low_stock_threshold,
    visibility: row.visibility,
    featured: Boolean(row.featured),
    featuredPosition: row.featured_position ?? null,
    isNew: Boolean(row.is_new),
    isDeal: Boolean(row.is_deal)
  });
  if (!candidate.success) throw new Error(candidate.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  const normalized = normalizeProductWriteInput(candidate.data);
  return {
    shortDescription: normalized.shortDescription,
    description: normalized.description,
    highlights: normalized.highlights ?? [],
    specs: normalized.specs ?? {},
    tags: normalized.tags ?? [],
    variants: normalized.variants ?? [],
    images: normalized.images,
    ...(details.imagePrompt ? { imagePrompt: details.imagePrompt } : {}),
    ...(normalized.seoTitle ? { seoTitle: normalized.seoTitle } : {}),
    ...(normalized.seoDescription ? { seoDescription: normalized.seoDescription } : {})
  } satisfies ProductDetails;
}

async function readRows(env: Env, options: CatalogMigrationOptions) {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const after = options.afterId ? " and p.id > ?" : "";
  const params = options.afterId ? [storeId(env), options.afterId, limit] : [storeId(env), limit];
  const rows = await env.DB.prepare(
    `select p.*, c.name as category_name
       from products p left join store_categories c on c.id = p.store_category_id and c.store_id = p.store_id
      where p.store_id = ?${after} order by p.id asc limit ?`
  ).bind(...params).all<ProductRow>();
  return rows.results ?? [];
}

/**
 * Audits and, when explicitly requested, normalizes one bounded page of a
 * store's legacy products. The cursor makes the operation resumable and the
 * dry-run default prevents accidental writes from an operator check.
 */
export async function migrateLegacyCatalog(env: Env, options: CatalogMigrationOptions): Promise<CatalogMigrationReport> {
  const rows = await readRows(env, options);
  const report: CatalogMigrationReport = {
    storeId: storeId(env),
    scanned: rows.length,
    migrated: 0,
    unchanged: 0,
    errors: [],
    nextCursor: rows.length === (options.limit ?? 25) ? rows.at(-1)?.id ?? null : null
  };
  const pending: Array<{ row: ProductRow; details: ProductDetails }> = [];

  for (const row of rows) {
    try {
      if (!row.store_category_id || !row.category_name) throw new Error("product category is missing or does not belong to this store");
      const details = canonicalDetails(row);
      pending.push({ row, details });
    } catch (error) {
      report.errors.push({ productId: row.id, message: error instanceof Error ? error.message : "Invalid product" });
    }
  }
  if (report.errors.length > 0 || options.dryRun) {
    report.unchanged = pending.length;
    return report;
  }

  const updates: Array<{ id: string; detailsJson: string }> = [];
  for (const { row, details } of pending) {
    const images = [details.images.main, ...details.images.gallery];
    const migratedImages: string[] = [];
    try {
      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        if (!image) throw new Error("product image is missing");
        if (isCloudinaryUrl(image)) {
          migratedImages.push(image);
          continue;
        }
        const response = await fetch(legacyImageUrl(env, image));
        if (!response.ok) throw new Error(`image request failed with ${response.status}`);
        const blob = await response.blob();
        const folder = `aether/products/${report.storeId}/${row.id}`;
        migratedImages.push(await uploadCloudinaryProductImage(env, blob, `image-${index + 1}`, folder));
      }
      updates.push({
        id: row.id,
        detailsJson: JSON.stringify({ ...details, images: { main: migratedImages[0], gallery: migratedImages.slice(1) } })
      });
    } catch (error) {
      report.errors.push({ productId: row.id, message: error instanceof Error ? error.message : "Image migration failed" });
    }
  }
  if (report.errors.length > 0) {
    report.unchanged = pending.length;
    return report;
  }

  const changed = updates.filter(({ id, detailsJson }) => {
    const row = rows.find((candidate) => candidate.id === id);
    return row?.details_json !== detailsJson;
  });
  if (changed.length > 0) {
    await env.DB.batch(changed.map(({ id, detailsJson }) => env.DB.prepare(
      "update products set details_json = ?, updated_at = ? where store_id = ? and id = ?"
    ).bind(detailsJson, new Date().toISOString(), report.storeId, id)));
    await clearCatalogCache(env);
  }
  report.migrated = changed.length;
  report.unchanged = updates.length - changed.length;
  return report;
}
