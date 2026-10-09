import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Env } from "../types";
import { CurrencySwitchError, convertCurrencyCents, switchStoreCurrency } from "./currency-switch";

function testEnv() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE products (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, price_cents INTEGER NOT NULL,
      compare_at_price_cents INTEGER, final_price_cents INTEGER NOT NULL, updated_at TEXT);
    CREATE TABLE coupons (code TEXT PRIMARY KEY, type TEXT NOT NULL, value INTEGER NOT NULL,
      minimum_subtotal INTEGER NOT NULL, updated_at TEXT);
    CREATE TABLE application_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT);
  `);
  sqlite.exec(readFileSync(new URL("../../../migrations/migrations/0033_currency_price_books.sql", import.meta.url), "utf8"));

  const prepare = (sql: string) => {
    let args: SQLInputValue[] = [];
    const statement = {
      bind(...values: SQLInputValue[]) { args = values; return statement; },
      all<T>() { return { results: sqlite.prepare(sql).all(...args) as T[] }; },
      first<T>() { return (sqlite.prepare(sql).get(...args) ?? null) as T | null; },
      run() { return sqlite.prepare(sql).run(...args); }
    };
    return statement;
  };
  const db = {
    prepare,
    batch(statements: Array<{ run(): unknown }>) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.run());
        sqlite.exec("COMMIT");
        return Promise.resolve(results);
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  };
  return { sqlite, env: { DB: db, STORE_ID: "store_default", STORE_CURRENCY: "USD" } as unknown as Env };
}

describe("reversible store currency", () => {
  it("rounds COP to 100 pesos without changing stored USD cents", () => {
    expect(convertCurrencyCents(4999, "USD", "COP", 3500)).toBe(17_500_000);
    expect(convertCurrencyCents(0, "USD", "COP", 3500)).toBe(0);
    expect(convertCurrencyCents(17_500_000, "COP", "USD", 3500)).toBe(5000);
  });

  it("restores exact USD prices, shipping and coupons after a COP switch", async () => {
    const { sqlite, env } = testEnv();
    sqlite.exec(`
      INSERT INTO products VALUES ('p1','store_default',4999,6999,4999,CURRENT_TIMESTAMP);
      INSERT INTO coupons VALUES ('SAVE5','fixed',555,1999,CURRENT_TIMESTAMP);
      INSERT INTO coupons VALUES ('TEN','percentage',10,1999,CURRENT_TIMESTAMP);
      INSERT INTO application_settings VALUES ('shipping','{"enabled":true,"amountCents":399}',CURRENT_TIMESTAMP);
    `);
    await expect(switchStoreCurrency(env, "COP")).rejects.toBeInstanceOf(CurrencySwitchError);
    await switchStoreCurrency(env, "COP", 3500);
    expect(sqlite.prepare("SELECT price_cents, compare_at_price_cents FROM products WHERE id='p1'").get())
      .toMatchObject({ price_cents: 17_500_000, compare_at_price_cents: 24_500_000 });
    expect(sqlite.prepare("SELECT value, minimum_subtotal FROM coupons WHERE code='SAVE5'").get())
      .toMatchObject({ value: 1_940_000, minimum_subtotal: 7_000_000 });
    expect(sqlite.prepare("SELECT value, minimum_subtotal FROM coupons WHERE code='TEN'").get())
      .toMatchObject({ value: 10, minimum_subtotal: 7_000_000 });
    expect((JSON.parse((sqlite.prepare("SELECT value_json FROM application_settings WHERE key='shipping'").get() as { value_json: string }).value_json) as { amountCents: number }).amountCents)
      .toBe(1_400_000);

    await switchStoreCurrency(env, "USD", 3500);
    expect(sqlite.prepare("SELECT price_cents, compare_at_price_cents FROM products WHERE id='p1'").get())
      .toMatchObject({ price_cents: 4999, compare_at_price_cents: 6999 });
    expect(sqlite.prepare("SELECT value, minimum_subtotal FROM coupons WHERE code='SAVE5'").get())
      .toMatchObject({ value: 555, minimum_subtotal: 1999 });
    expect((JSON.parse((sqlite.prepare("SELECT value_json FROM application_settings WHERE key='shipping'").get() as { value_json: string }).value_json) as { amountCents: number }).amountCents)
      .toBe(399);

    await switchStoreCurrency(env, "COP", 3500);
    expect((sqlite.prepare("SELECT price_cents FROM products WHERE id='p1'").get() as { price_cents: number }).price_cents)
      .toBe(17_500_000);
    await expect(switchStoreCurrency(env, "USD", 4000)).rejects.toMatchObject({ code: "RATE_LOCKED" });

    sqlite.exec("INSERT INTO products VALUES ('p2','store_default',7000000,NULL,7000000,CURRENT_TIMESTAMP)");
    await switchStoreCurrency(env, "USD", 3500);
    expect((sqlite.prepare("SELECT final_price_cents FROM products WHERE id='p2'").get() as { final_price_cents: number }).final_price_cents)
      .toBe(2000);
    await switchStoreCurrency(env, "COP", 3500);
    expect((sqlite.prepare("SELECT final_price_cents FROM products WHERE id='p2'").get() as { final_price_cents: number }).final_price_cents)
      .toBe(7000000);
  });
});
