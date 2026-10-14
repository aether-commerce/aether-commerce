import { describe, expect, it } from "vitest";
import type { Product } from "@aether-commerce/schemas";
import type { Env } from "../types";
import { bumpCatalogGeneration, catalogCacheKey, clearCatalogCache, __testables } from "./catalog";

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

describe("catalog generation cache", () => {
  it("isolates cached product snapshots by store and catalog generation", async () => {
    const DB = new FakeD1();
    const env = { DB, STORE_ID: "catalog-cache-test" } as unknown as Env;
    const product = { id: "prd_cache_test", name: "Cache test" } as Product;

    await bumpCatalogGeneration(env);
    const firstGeneration = await __testables.readCatalogGeneration(env);
    await __testables.writeCachedProducts(env, [product], firstGeneration);
    expect(await __testables.readCachedProducts(env, firstGeneration)).toEqual([product]);

    await bumpCatalogGeneration(env);
    const nextGeneration = await __testables.readCatalogGeneration(env);
    expect(nextGeneration).toBe(firstGeneration + 1);
    expect(await __testables.readCachedProducts(env, nextGeneration)).toBeNull();
    expect(DB.reads).toContain(`${catalogCacheKey}:catalog-cache-test:${nextGeneration}`);
  });

  it("keeps generation invalidation successful when stale snapshot cleanup fails", async () => {
    const DB = new FakeD1();
    const env = { DB, STORE_ID: "catalog-cache-cleanup-test" } as unknown as Env;
    await bumpCatalogGeneration(env);
    const generation = await __testables.readCatalogGeneration(env);
    DB.failDeletes = true;

    await expect(bumpCatalogGeneration(env)).resolves.toBeUndefined();
    await expect(clearCatalogCache(env)).resolves.toBeUndefined();
    expect(await __testables.readCatalogGeneration(env)).toBe(generation + 1);
  });
});
