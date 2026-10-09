import type { Env } from "../types";
import { getStoreConfig } from "./store-config";

type Currency = "USD" | "COP";
type ProductAmounts = {
  id: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  final_price_cents: number;
};
type CouponAmounts = {
  code: string;
  type: "fixed" | "percentage";
  value: number;
  minimum_subtotal: number;
};
type ProductBook = Omit<ProductAmounts, "id"> & { product_id: string };
type CouponBook = Omit<CouponAmounts, "code">;

export class CurrencySwitchError extends Error {
  constructor(public readonly code: "RATE_REQUIRED" | "RATE_LOCKED") {
    super(code === "RATE_REQUIRED" ? "A fixed COP per USD rate is required." : "The fixed rate cannot change after prices have been saved.");
  }
}

/** COP amounts are stored in cents, rounded to the nearest 100 pesos. */
export function convertCurrencyCents(cents: number, from: Currency, to: Currency, copPerUsd: number): number {
  if (from === to || cents === 0) return cents;
  if (to === "COP") return Math.max(10_000, Math.round((cents * copPerUsd) / 10_000) * 10_000);
  return Math.max(1, Math.round(cents / copPerUsd));
}

const byProduct = (rows: ProductBook[]) => new Map(rows.map((row) => [row.product_id, row]));
const byCoupon = (rows: (CouponBook & { code: string })[]) => new Map(rows.map((row) => [row.code, row]));

/** Saves both currency price lists and switches live prices in one D1 transaction. */
export async function switchStoreCurrency(env: Env, target: Currency, suppliedRate?: number) {
  const current = (await getStoreConfig(env)).currency;
  if (current === target) return { currency: target };

  const savedRateRow = await env.DB.prepare("select value_json from application_settings where key = 'currency_conversion'")
    .first<{ value_json: string }>();
  const savedRate = savedRateRow ? (JSON.parse(savedRateRow.value_json) as { copPerUsd: number }).copPerUsd : undefined;
  if (!savedRate && !suppliedRate) throw new CurrencySwitchError("RATE_REQUIRED");
  if (savedRate && suppliedRate && savedRate !== suppliedRate) throw new CurrencySwitchError("RATE_LOCKED");
  const rate = savedRate ?? suppliedRate!;

  const storeId = env.STORE_ID?.trim() || "store_default";
  const [productsResult, productBooksResult, couponsResult, couponBooksResult, shippingRow, shippingBook] = await Promise.all([
    env.DB.prepare("select id, price_cents, compare_at_price_cents, final_price_cents from products where store_id = ?").bind(storeId).all<ProductAmounts>(),
    env.DB.prepare("select product_id, price_cents, compare_at_price_cents, final_price_cents from product_currency_prices where currency = ?").bind(target).all<ProductBook>(),
    env.DB.prepare("select code, type, value, minimum_subtotal from coupons").all<CouponAmounts>(),
    env.DB.prepare("select code, type, value, minimum_subtotal from coupon_currency_amounts where currency = ?").bind(target).all<CouponBook & { code: string }>(),
    env.DB.prepare("select value_json from application_settings where key = 'shipping'").first<{ value_json: string }>(),
    env.DB.prepare("select amount_cents from shipping_currency_amounts where currency = ?").bind(target).first<{ amount_cents: number }>()
  ]);
  const products = productsResult.results;
  const coupons = couponsResult.results;
  const productBooks = byProduct(productBooksResult.results);
  const couponBooks = byCoupon(couponBooksResult.results);
  const shipping = shippingRow ? JSON.parse(shippingRow.value_json) as { enabled?: boolean; amountCents?: number } : { enabled: false, amountCents: 0 };
  const currentShippingAmount = Number.isSafeInteger(shipping.amountCents) && (shipping.amountCents ?? 0) >= 0 ? shipping.amountCents! : 0;
  const targetShippingAmount = shippingBook?.amount_cents ?? convertCurrencyCents(currentShippingAmount, current, target, rate);
  const queries: D1PreparedStatement[] = [];

  for (const product of products) {
    queries.push(env.DB.prepare(
      `insert into product_currency_prices (product_id, currency, price_cents, compare_at_price_cents, final_price_cents)
       values (?, ?, ?, ?, ?) on conflict(product_id, currency) do update set
       price_cents = excluded.price_cents, compare_at_price_cents = excluded.compare_at_price_cents,
       final_price_cents = excluded.final_price_cents`
    ).bind(product.id, current, product.price_cents, product.compare_at_price_cents, product.final_price_cents));
    const next = productBooks.get(product.id) ?? {
      price_cents: convertCurrencyCents(product.price_cents, current, target, rate),
      compare_at_price_cents: product.compare_at_price_cents === null ? null : convertCurrencyCents(product.compare_at_price_cents, current, target, rate),
      final_price_cents: convertCurrencyCents(product.final_price_cents, current, target, rate)
    };
    if (!productBooks.has(product.id)) queries.push(env.DB.prepare(
      "insert into product_currency_prices (product_id, currency, price_cents, compare_at_price_cents, final_price_cents) values (?, ?, ?, ?, ?)"
    ).bind(product.id, target, next.price_cents, next.compare_at_price_cents, next.final_price_cents));
    queries.push(env.DB.prepare(
      "update products set price_cents = ?, compare_at_price_cents = ?, final_price_cents = ?, updated_at = CURRENT_TIMESTAMP where id = ? and store_id = ?"
    ).bind(next.price_cents, next.compare_at_price_cents, next.final_price_cents, product.id, storeId));
  }

  for (const coupon of coupons) {
    queries.push(env.DB.prepare(
      `insert into coupon_currency_amounts (code, currency, type, value, minimum_subtotal) values (?, ?, ?, ?, ?)
       on conflict(code, currency) do update set type = excluded.type, value = excluded.value,
       minimum_subtotal = excluded.minimum_subtotal`
    ).bind(coupon.code, current, coupon.type, coupon.value, coupon.minimum_subtotal));
    const book = couponBooks.get(coupon.code);
    const next = book?.type === coupon.type ? book : {
      type: coupon.type,
      value: coupon.type === "percentage" ? coupon.value : convertCurrencyCents(coupon.value, current, target, rate),
      minimum_subtotal: convertCurrencyCents(coupon.minimum_subtotal, current, target, rate)
    };
    if (!book || book.type !== coupon.type) queries.push(env.DB.prepare(
      `insert into coupon_currency_amounts (code, currency, type, value, minimum_subtotal) values (?, ?, ?, ?, ?)
       on conflict(code, currency) do update set type = excluded.type, value = excluded.value,
       minimum_subtotal = excluded.minimum_subtotal`
    ).bind(coupon.code, target, next.type, next.value, next.minimum_subtotal));
    queries.push(env.DB.prepare(
      "update coupons set value = ?, minimum_subtotal = ?, updated_at = CURRENT_TIMESTAMP where code = ?"
    ).bind(coupon.type === "percentage" ? coupon.value : next.value, next.minimum_subtotal, coupon.code));
  }

  queries.push(env.DB.prepare(
    "insert into shipping_currency_amounts (currency, amount_cents) values (?, ?) on conflict(currency) do update set amount_cents = excluded.amount_cents"
  ).bind(current, currentShippingAmount));
  if (!shippingBook) queries.push(env.DB.prepare("insert into shipping_currency_amounts (currency, amount_cents) values (?, ?)").bind(target, targetShippingAmount));
  queries.push(env.DB.prepare(
    `insert into application_settings (key, value_json, updated_at) values ('shipping', ?, CURRENT_TIMESTAMP)
     on conflict(key) do update set value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP`
  ).bind(JSON.stringify({ enabled: shipping.enabled === true, amountCents: targetShippingAmount })));
  queries.push(env.DB.prepare(
    `insert into application_settings (key, value_json, updated_at) values ('currency_conversion', ?, CURRENT_TIMESTAMP)
     on conflict(key) do update set value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP`
  ).bind(JSON.stringify({ copPerUsd: rate })));
  queries.push(env.DB.prepare(
    `insert into application_settings (key, value_json, updated_at) values ('store', ?, CURRENT_TIMESTAMP)
     on conflict(key) do update set value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP`
  ).bind(JSON.stringify({ currency: target })));
  await env.DB.batch(queries);
  return { currency: target, copPerUsd: rate, products: products.length, coupons: coupons.length };
}
