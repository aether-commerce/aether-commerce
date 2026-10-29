import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Product } from "@aether-commerce/schemas";
import type { Env } from "../types";
import { __testables } from "./catalog";

// Execute the production SQL against SQLite instead of duplicating its logic
// in a fake D1 implementation. D1 uses SQLite and exposes the same statements.
function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`create table products_cache (
    id text primary key, source text not null, payload_json text not null,
    expires_at text not null, created_at text default CURRENT_TIMESTAMP,
    updated_at text default CURRENT_TIMESTAMP
  )`);
  const DB = {
    prepare(sql: string) {
      return {
        bind(...values: SQLInputValue[]) {
          return {
            first: () => sqlite.prepare(sql).get(...values) ?? null,
            run: () => sqlite.prepare(sql).run(...values)
          };
        }
      };
    }
  };
  return { sqlite, DB };
}

describe("catalog snapshot retention", () => {
  it("removes older snapshots without touching another store or its generation", async () => {
    const { sqlite, DB } = createDatabase();
    const env = { DB, STORE_ID: "shop" } as unknown as Env;
    sqlite.exec(`insert into products_cache (id, source, payload_json, expires_at) values
      ('catalog-generation:shop', 'catalog-generation', '2', '9999-12-31'),
      ('products-v3:shop:1', 'local', '[]', '2000-01-01'),
      ('products-v3:shop:other:1', 'local', '[]', '2000-01-01'),
      ('catalog-generation:shop:other', 'catalog-generation', '1', '9999-12-31')`);
    await __testables.writeCachedProducts(env, [{ id: "new" } as Product], 2);
    const ids = sqlite.prepare("select id from products_cache order by id").all().map((row) => row.id);
    expect(ids).toEqual([
      "catalog-generation:shop", "catalog-generation:shop:other",
      "products-v3:shop:2", "products-v3:shop:other:1"
    ]);
    sqlite.close();
  });

  it("does not recreate an older snapshot when a slow fill finishes after a new generation", async () => {
    const { sqlite, DB } = createDatabase();
    const env = { DB, STORE_ID: "race" } as unknown as Env;
    sqlite.exec("insert into products_cache (id, source, payload_json, expires_at) values ('catalog-generation:race', 'catalog-generation', '2', '9999-12-31')");
    await __testables.writeCachedProducts(env, [{ id: "new" } as Product], 2);
    await __testables.writeCachedProducts(env, [{ id: "old" } as Product], 1);
    const rows = sqlite.prepare("select id, payload_json from products_cache where source = 'local'").all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("products-v3:race:2");
    expect(JSON.parse(String(rows[0]?.payload_json))).toEqual([{ id: "new" }]);
    sqlite.close();
  });
});
