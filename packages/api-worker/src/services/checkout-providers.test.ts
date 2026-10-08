import { afterEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "@aether-commerce/schemas";
import type { Env } from "../types";
import { createStripeCheckoutProvider, getStripeSecretKeyStatus, mapStripeSessionToPaidCheckoutSession } from "./stripe";
import { createWompiCheckoutProvider, getWompiSecretKeyStatus, mapWompiTransactionToPaidCheckoutSession, verifyWompiSignature } from "./wompi";

afterEach(() => vi.unstubAllGlobals());
const quotedCart = {
  id: "cart_1", userId: "user_1", updatedAt: new Date().toISOString(),
  items: [{ productId: "p_1", name: "Product", quantity: 1, finalUnitPrice: 10000, lineTotal: 10000 }],
  totals: { subtotal: 10000, discount: 1000, shipping: 500, tax: 0, total: 9500, currency: "COP" }
} as Cart;

describe("stripe adapter", () => {
  it("classifies secret key shapes", () => {
    expect(getStripeSecretKeyStatus(undefined)).toBe("missing");
    expect(getStripeSecretKeyStatus("sk_test_abc")).toBe("test_secret");
    expect(getStripeSecretKeyStatus("sk_live_abc")).toBe("live_secret");
    expect(getStripeSecretKeyStatus("pk_test_abc")).toBe("publishable_key");
  });

  it("maps a Stripe checkout session onto the provider-neutral shape", () => {
    expect(
      mapStripeSessionToPaidCheckoutSession({
        id: "cs_123",
        payment_status: "paid",
        amount_total: 1999,
        currency: "usd",
        customer_details: { email: "buyer@example.com" },
        metadata: { cartId: "cart_1", userId: "user_1" },
        payment_intent: "pi_123"
      })
    ).toEqual({
      id: "cs_123",
      status: "paid",
      amountTotal: 1999,
      currency: "usd",
      customerEmail: "buyer@example.com",
      metadata: { cartId: "cart_1", userId: "user_1" },
      providerReference: "pi_123"
    });
  });

  it("treats a non-paid Stripe session as pending, not failed", () => {
    expect(mapStripeSessionToPaidCheckoutSession({ id: "cs_456", payment_status: "unpaid" }).status).toBe("pending");
    expect(mapStripeSessionToPaidCheckoutSession({ id: "cs_789" }).status).toBe("pending");
  });

  it("charges the authoritative discounted and shipped total", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
      const params = new URLSearchParams(init.body as string);
      expect(params.get("line_items[0][price_data][unit_amount]")).toBe("9500");
      expect(params.get("line_items[1][price_data][unit_amount]")).toBeNull();
      expect(Number(params.get("expires_at"))).toBeGreaterThan(Math.floor(Date.now() / 1000) + 3500);
      return Promise.resolve(new Response(JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/one" })));
    }));
    await createStripeCheckoutProvider({ AETHER_ENV: "production" } as Env, { secretKey: "sk_test_1" })
      .createCheckoutSession(quotedCart, "buyer@example.com", "chk_1");
  });

  it("never returns a simulated checkout in production without credentials", async () => {
    await expect(createStripeCheckoutProvider({ AETHER_ENV: "production" } as Env)
      .createCheckoutSession(quotedCart)).rejects.toThrow("not configured");
  });
});

describe("wompi adapter", () => {
  it("classifies secret key shapes", () => {
    expect(getWompiSecretKeyStatus(undefined)).toBe("missing");
    expect(getWompiSecretKeyStatus("prv_test_abc")).toBe("test_secret");
    expect(getWompiSecretKeyStatus("prv_prod_abc")).toBe("live_secret");
    expect(getWompiSecretKeyStatus("pub_test_abc")).toBe("publishable_key");
  });

  it("maps an approved Wompi transaction onto the provider-neutral shape, decoding cartId/userId from reference", () => {
    expect(
      mapWompiTransactionToPaidCheckoutSession({
        id: "txn_123",
        status: "APPROVED",
        amount_in_cents: 4490000,
        currency: "COP",
        reference: "cart_1::user_1",
        customer_email: "buyer@example.com"
      })
    ).toEqual({
      id: "txn_123",
      status: "paid",
      amountTotal: 4490000,
      currency: "COP",
      customerEmail: "buyer@example.com",
      metadata: { cartId: "cart_1", userId: "user_1" },
      providerReference: "txn_123"
    });
  });

  it("maps every Wompi status onto the provider-neutral vocabulary", () => {
    const statusFor = (status: string) => mapWompiTransactionToPaidCheckoutSession({ id: "txn_1", status }).status;
    expect(statusFor("APPROVED")).toBe("paid");
    expect(statusFor("PENDING")).toBe("pending");
    expect(statusFor("DECLINED")).toBe("failed");
    expect(statusFor("VOIDED")).toBe("failed");
    expect(statusFor("ERROR")).toBe("failed");
    expect(statusFor("SOMETHING_UNDOCUMENTED")).toBe("unknown");
  });

  it("sends the same total to Wompi and rejects a missing production secret", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { amount_in_cents: number; expires_at: string };
      expect(body.amount_in_cents).toBe(9500);
      expect(Date.parse(body.expires_at)).toBeGreaterThan(Date.now() + 3_500_000);
      return Promise.resolve(new Response(JSON.stringify({ data: { id: "link_1" } })));
    }));
    await createWompiCheckoutProvider({ AETHER_ENV: "production" } as Env, { secretKey: "prv_test_1" })
      .createCheckoutSession(quotedCart, undefined, "chk_1");
    await expect(createWompiCheckoutProvider({ AETHER_ENV: "production" } as Env)
      .createCheckoutSession(quotedCart, undefined, "chk_2")).rejects.toThrow("not configured");
  });

  it("accepts a signed transaction path and rejects changed data or absent properties", async () => {
    if (typeof crypto.subtle.timingSafeEqual !== "function") {
      crypto.subtle.timingSafeEqual = (a: BufferSource, b: BufferSource) => {
        const left = new Uint8Array(a as ArrayBuffer);
        const right = new Uint8Array(b as ArrayBuffer);
        return left.length === right.length && left.every((value, index) => value === right[index]);
      };
    }
    const secret = "events-secret";
    const event = { event: "transaction.updated", data: { transaction: { id: "txn_1", status: "APPROVED" } }, timestamp: 1720000000,
      signature: { properties: ["transaction.id", "transaction.status"], checksum: "" } };
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`txn_1APPROVED${event.timestamp}${secret}`));
    event.signature.checksum = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    expect(await verifyWompiSignature(secret, event)).toBe(true);
    expect(await verifyWompiSignature(secret, { ...event, data: { transaction: { ...event.data.transaction, status: "DECLINED" } } })).toBe(false);
    expect(await verifyWompiSignature(secret, { ...event, signature: { ...event.signature, properties: ["transaction.missing"] } })).toBe(false);
  });

  // Checksum comparison goes through timingSafeEqualText, which calls the
  // Cloudflare Workers-only crypto.subtle.timingSafeEqual extension (same as
  // verifyStripeSignature) - not available under vitest's Node environment,
  // which is why that call path is covered by a static presence check in
  // tests/contracts.test.mjs instead of a runtime unit test here.
  it("rejects a webhook missing signature metadata without needing to compare a checksum", async () => {
    expect(await verifyWompiSignature("events-secret", { event: "transaction.updated" })).toBe(false);
  });
});
