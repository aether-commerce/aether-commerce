import { describe, expect, it, vi } from "vitest";
import type { Env } from "../types";
import { migrateLegacyCatalog } from "./catalog-migration";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "prd_1",
    sku: "SKU-1",
    slug: "producto-1",
    name: " Producto 1 ",
    brand: null,
    category: "general",
    category_name: "General",
    store_category_id: "cat_general",
    subcategory: null,
    price_cents: 1000,
    compare_at_price_cents: null,
    final_price_cents: 1000,
    stock: 4,
    low_stock_threshold: 4,
    visibility: "visible" as const,
    featured: 0,
    featured_position: null,
    is_new: 0,
    is_deal: 0,
    rating_average: 0,
    rating_count: 0,
    details_json: JSON.stringify({
      shortDescription: "  Corto  ",
      description: "  Descripción  ",
      highlights: [" Uno ", "Dos"],
      specs: { Material: "  Acero " },
      tags: [" producto "],
      variants: [],
      images: { main: "https://res.cloudinary.com/demo/image/upload/aether/products/existing.jpg", gallery: [] }
    }),
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function fakeEnv(results: unknown[]) {
  const prepare = vi.fn(() => ({
    bind: vi.fn(() => ({ all: vi.fn(() => Promise.resolve({ results })) }))
  }));
  return { env: { DB: { prepare } } as unknown as Env, prepare };
}

describe("migrateLegacyCatalog", () => {
  it("audits and normalizes without writing in dry-run mode", async () => {
    const { env, prepare } = fakeEnv([row()]);
    const report = await migrateLegacyCatalog(env, { dryRun: true, limit: 25 });
    expect(report).toMatchObject({ scanned: 1, migrated: 0, unchanged: 1, errors: [] });
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("reports malformed legacy details and never writes the batch", async () => {
    const { env } = fakeEnv([row({ details_json: "not-json" })]);
    const report = await migrateLegacyCatalog(env, { dryRun: false, limit: 25 });
    expect(report.errors[0]?.message).toMatch(/valid JSON/i);
    expect(report.migrated).toBe(0);
  });
});
