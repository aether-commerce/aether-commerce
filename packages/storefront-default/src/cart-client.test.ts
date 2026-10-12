// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCartClient } from "./cart-client";
import type { CartItem } from "@aether-commerce/schemas";

describe("local cart currency recovery", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reprices an older USD cart from the current COP catalog without changing quantity", async () => {
    window.localStorage.setItem("aether.cartId.dummyjson.v2", "cart_test");
    window.localStorage.setItem("aether.localCartItems.dummyjson.v1", JSON.stringify([{
      productId: "support_1",
      slug: "soporte-plegable-de-escritorio",
      quantity: 2,
      name: "Soporte Plegable de Escritorio",
      imageUrl: null,
      unitPrice: 1900,
      finalUnitPrice: 1900,
      lineTotal: 3800,
      currency: "USD"
    }]));
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
      expect(url).toBe("https://api.example.test/api/v1/catalog/products/soporte-plegable-de-escritorio");
      expect(init?.method).toBeUndefined();
      return Promise.resolve(Response.json({ success: true, data: {
        id: "support_1",
        slug: "soporte-plegable-de-escritorio",
        name: "Soporte Plegable de Escritorio",
        price: 6_650_000,
        finalPrice: 6_650_000,
        currency: "COP",
        variants: [],
        images: [],
        thumbnail: null
      } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createCartClient("https://api.example.test");
    expect(client.readLocalCart().items[0]?.currency).toBe("USD");
    const cart = await client.refreshLocalCartPrices();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cart.items[0]).toMatchObject({ quantity: 2, currency: "COP", finalUnitPrice: 6_650_000, lineTotal: 13_300_000 });
    expect(cart.totals.currency).toBe("COP");
    expect(cart.totals.total).toBe(13_300_000);
    expect(client.readLocalCart().items[0]?.currency).toBe("COP");
  });
});

describe("paid checkout cart reconciliation", () => {
  const items: CartItem[] = [{
    productId: "product_1", slug: "demo-product", quantity: 1,
    name: "Demo Product", imageUrl: "https://example.test/product.png", unitPrice: 3500,
    finalUnitPrice: 3500, lineTotal: 3500, currency: "COP"
  }];

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("aether.cartId.dummyjson.v2", "cart_paid");
    window.localStorage.setItem("aether.localCartItems.dummyjson.v1", JSON.stringify(items));
    window.sessionStorage.setItem("aether.checkoutAttempt.v1", JSON.stringify({
      signature: JSON.stringify({ cartId: "cart_paid", items, shippingAddress: null }),
      key: "attempt_1"
    }));
  });

  it("clears the matching local cart after confirmation and does not clear it again on refresh", () => {
    const client = createCartClient("https://api.example.test");
    const changed = vi.fn();
    window.addEventListener("aether-cart-changed", changed);
    try {
      expect(client.clearConfirmedCheckoutCart("cart_paid")).toBe(true);
      expect(client.readLocalCartItems()).toEqual([]);
      expect(window.sessionStorage.getItem("aether.checkoutAttempt.v1")).toBeNull();
      expect(changed).toHaveBeenCalledTimes(1);

      client.replaceLocalCartItems(items);
      expect(client.clearConfirmedCheckoutCart("cart_paid")).toBe(false);
      expect(client.readLocalCartItems()).toEqual(items);
    } finally {
      window.removeEventListener("aether-cart-changed", changed);
    }
  });

  it("preserves items added while the payment was pending", () => {
    const client = createCartClient("https://api.example.test");
    const updated = [...items, { ...items[0]!, productId: "product_2", slug: "other-product" }];
    client.replaceLocalCartItems(updated);

    expect(client.clearConfirmedCheckoutCart("cart_paid")).toBe(false);
    expect(client.readLocalCartItems()).toEqual(updated);
  });

  it("does not clear a different cart or an untracked checkout", () => {
    const client = createCartClient("https://api.example.test");
    expect(client.clearConfirmedCheckoutCart("cart_other")).toBe(false);
    window.sessionStorage.removeItem("aether.checkoutAttempt.v1");
    expect(client.clearConfirmedCheckoutCart("cart_paid")).toBe(false);
    expect(client.readLocalCartItems()).toEqual(items);
  });
});
