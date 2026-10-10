// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCartClient } from "./cart-client";

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
