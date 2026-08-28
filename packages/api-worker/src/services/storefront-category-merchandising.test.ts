import { describe, expect, it } from "vitest";
import type { Env } from "../types";
import { getStorefrontCategorySection } from "./storefront-category-merchandising";

function mockEnv() {
  const queries: string[] = [];
  const DB = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind() { return this; },
        first() {
          if (query.includes("storefront_category_sections")) return { store_id: "store_alpha", enabled: 1, eyebrow: "CATEGORIES", title: "Shop by category", description: "A curated collection." };
          return null;
        },
        all() {
          return { results: [{ id: "cfg_1", store_id: "store_alpha", category_id: "cat_phones", enabled: 1, position: 0, display_name: "Phones", description: "Daily essentials.", visual_type: "icon", icon_key: "smartphone", image_url: null, slug: "smartphones", name: "Smartphones", is_hidden: 0, product_count: 25 }] };
        }
      };
    }
  };
  return { env: { STORE_ID: "store_alpha", DB } as unknown as Env, queries };
}

describe("storefront category merchandising", () => {
  it("returns one theme-neutral section DTO with public product counts in a grouped, store-scoped query", async () => {
    const { env, queries } = mockEnv();
    await expect(getStorefrontCategorySection(env)).resolves.toEqual({
      section: { enabled: true, eyebrow: "CATEGORIES", title: "Shop by category", description: "A curated collection." },
      categories: [{ id: "cat_phones", slug: "smartphones", displayName: "Phones", description: "Daily essentials.", visual: { type: "icon", key: "smartphone" }, productCount: 25 }]
    });
    expect(queries.filter((query) => query.includes("storefront_category_configs"))).toHaveLength(1);
    expect(queries.some((query) => query.includes("m.store_id = ?") && query.includes("p.visibility = 'visible'") && query.includes("group by m.id"))).toBe(true);
  });

  it("returns a safe disabled fallback when a store has not configured the section", async () => {
    const env = {
      STORE_ID: "store_empty",
      DB: {
        prepare() {
          return { bind() { return this; }, first() { return null; }, all() { return { results: [] }; } };
        }
      }
    } as unknown as Env;
    await expect(getStorefrontCategorySection(env)).resolves.toEqual({ section: { enabled: false, eyebrow: null, title: null, description: null }, categories: [] });
  });
});
