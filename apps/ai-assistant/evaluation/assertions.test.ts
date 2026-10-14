import { describe, expect, it } from "vitest";
import { evaluateCase } from "./assertions.mjs";

describe("purchase decision acceptance checks", () => {
  it("requires every requested comparison item to be distinct and in the requested currency", () => {
    const entry = {
      expected: {
        product_names: ["GaN 65W", "Wireless 15W"],
        min_distinct_products: 2,
        currency: "COP"
      }
    };
    const duplicate = {
      products: [
        { product_id: "gan", name: "GaN 65W", currency: "COP" },
        { product_id: "gan", name: "Wireless 15W", currency: "COP" }
      ]
    };

    expect(evaluateCase(entry, duplicate).find((check) => check.name === "distinct_products")?.pass).toBe(false);
    expect(evaluateCase(entry, duplicate).find((check) => check.name === "product_currency")?.pass).toBe(true);
  });

  it("checks the sum in minor currency units, not just each product separately", () => {
    const entry = { expected: { min_distinct_products: 2, max_combined_price_minor_units: 20_000_000 } };
    const withinBudget = {
      products: [
        { product_id: "one", price: "115500", currency: "COP" },
        { product_id: "two", price: "80000", currency: "COP" }
      ]
    };
    const overBudget = {
      products: [
        { product_id: "one", price: "120001", currency: "COP" },
        { product_id: "two", price: "80000", currency: "COP" }
      ]
    };

    expect(evaluateCase(entry, withinBudget).find((check) => check.name === "combined_budget")?.pass).toBe(true);
    expect(evaluateCase(entry, overBudget).find((check) => check.name === "combined_budget")?.pass).toBe(false);
  });

  it("rejects missing or malformed prices instead of treating them as zero", () => {
    const entry = { expected: { max_combined_price_minor_units: 20_000_000 } };
    const payload = { products: [{ price: "not-a-price" }, { price: "80000" }] };

    expect(evaluateCase(entry, payload).find((check) => check.name === "combined_budget")?.pass).toBe(false);
  });

  it("rejects a combined total that cannot be represented safely", () => {
    const entry = { expected: { max_combined_price_minor_units: Number.MAX_SAFE_INTEGER } };
    const payload = {
      products: [
        { product_id: "one", price: "90071992547409.91" },
        { product_id: "two", price: "1" }
      ]
    };

    expect(evaluateCase(entry, payload).find((check) => check.name === "combined_budget")?.pass).toBe(false);
  });

  it("requires specification evidence and rejects an unsupported compatibility claim", () => {
    const entry = {
      expected: {
        product_specifications: [
          { product: "Desk Stand", key: "Compatibility", value: "Small phones and tablets" }
        ],
        message_must_not_contain: ["it supports a 17-inch laptop"]
      }
    };
    const payload = {
      message: "The catalog only lists small phones and tablets; it supports a 17-inch laptop.",
      products: [{
        name: "Desk Stand",
        specifications: [{ key: "Compatibility", value: "Small phones and tablets" }]
      }]
    };

    const checks = evaluateCase(entry, payload);
    expect(checks.find((check) => check.name === "catalog_specifications")?.pass).toBe(true);
    expect(checks.find((check) => check.name === "message_does_not_overclaim")?.pass).toBe(false);
  });

  it("requires a currency-mismatch clarification to return no wrongly priced products", () => {
    const entry = { expected: { max_products: 0, message_contains: ["budget in COP"] } };
    const payload = { message: "Please state your budget in COP.", products: [] };

    expect(evaluateCase(entry, payload).every((check) => check.pass)).toBe(true);
    expect(evaluateCase(entry, { ...payload, products: [{ price: "50", currency: "USD" }] })
      .find((check) => check.name === "maximum_product_count")?.pass).toBe(false);
  });
});
