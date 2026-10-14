import { describe, expect, it } from "vitest";
import type { Product } from "@aether-commerce/schemas";
import type { Env } from "../packages/api-worker/src/types";
import { bumpCatalogGeneration, catalogCacheKey, __testables } from "../packages/api-worker/src/services/catalog";

type CachedRow = { payload_json: string; source: string };

class FakeD1 {
  rows = new Map<string, CachedRow>();
  reads: string[] = [];
  failDeletes = false;

  prepare(sql: string) {
    return {
      bind: (...values: unknown[]) => ({
        first: <T>() => {
          const id = String(values[0]);
          this.reads.push(id);
          return (this.rows.get(id) ?? null) as T | null;
        },
        run: () => {
          if (/^\s*insert into products_cache/i.test(sql)) {
            const id = String(values[0]);
            const isGeneration = sql.includes("'catalog-generation'");
            const existing = this.rows.get(id);
            if (isGeneration) {
              const generation = existing ? Number(existing.payload_json) + 1 : 1;
              this.rows.set(id, { source: "catalog-generation", payload_json: String(generation) });
            } else {
              this.rows.set(id, { source: "local", payload_json: String(values[1]) });
            }
          }
          if (/^\s*delete from products_cache/i.test(sql)) {
            if (this.failDeletes) throw new Error("simulated cache cleanup failure");
            const prefix = String(values[1]);
            for (const id of this.rows.keys()) if (id.startsWith(prefix)) this.rows.delete(id);
          }
          return { success: true };
        }
      })
    };
  }

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    for (const statement of statements) await statement.run();
    return [];
  }
}

describe("catalog cache coherence across Worker isolates", () => {
  it("bypasses a hot isolate snapshot as soon as D1 reports a newer generation", async () => {
    const DB = new FakeD1();
    const currentStoreId = "catalog-cache-cross-isolate-test";
    const env = { DB, STORE_ID: currentStoreId } as unknown as Env;
    const staleProduct = { id: "prd_stale", name: "Before edit" } as Product;

    await bumpCatalogGeneration(env);
    const originalGeneration = await __testables.readCatalogGeneration(env);
    await __testables.writeCachedProducts(env, [staleProduct], originalGeneration);
    expect(await __testables.readCachedProducts(env, originalGeneration)).toEqual([staleProduct]);

    const readsBeforeExternalChange = DB.reads.length;
    DB.rows.set(`catalog-generation:${currentStoreId}`, {
      source: "catalog-generation",
      payload_json: String(originalGeneration + 1)
    });

    const committedGeneration = await __testables.readCatalogGeneration(env);
    expect(committedGeneration).toBe(originalGeneration + 1);
    expect(await __testables.readCachedProducts(env, committedGeneration)).toBeNull();
    expect(DB.reads.slice(readsBeforeExternalChange)).toContain(
      `${catalogCacheKey}:${currentStoreId}:${committedGeneration}`
    );
  });
});
