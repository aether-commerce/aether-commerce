import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { isCheckoutSessionPaid } from "@aether-commerce/api-core";
import { addressSchema } from "@aether-commerce/schemas";
import type { AppBindings } from "../types";
import { fail, ok } from "../http";
import { CheckoutQuoteChangedError, readCart, repriceCartForCheckout, writeCart } from "../services/cart";
import { resolveActorEmail } from "../services/clerk";
import { createCheckoutProviderFor, resolveCheckoutSettings } from "../services/checkout-provider";
import { createOrderFromPaidSession } from "../services/orders";
import { verifyCartToken } from "../services/cart-token";
import { CHECKOUT_EXTENSION_MINUTES, extendCartReservations, upsertActiveReservation } from "../services/inventory";
import { getProductById } from "../services/catalog";
import { bindCheckoutSnapshotToSession, createCheckoutSnapshot } from "../services/checkout-snapshots";
import { getRuntimeStoreConfig } from "../services/store-config";
import { createShippingSettingsService } from "../services/shipping-settings";
import { defaultShippingSettings } from "../defaults";
import { withIdempotency } from "../services/idempotency";

export const checkoutRoutes = new Hono<AppBindings>();

// Relaxes addressSchema's postalCode (min 3) since Colombian storefront
// addresses commonly go without one, and fixes country server-side rather
// than asking the storefront's /checkout form for it - the checkout page
// only collects what the operator actually asked for (name, phone, address,
// city, department). Both gaps are filled in below before this rides along
// on the immutable checkout snapshot, so the value stored on the eventual
// order still satisfies the stricter schema addressSchema everywhere else
// expects.
const checkoutShippingAddressSchema = addressSchema.omit({ postalCode: true, country: true }).extend({
  postalCode: z.string().optional()
});

checkoutRoutes.post(
  "/session",
  zValidator("json", z.object({ cartId: z.string().min(1), shippingAddress: checkoutShippingAddressSchema.optional() })),
  async (c) => {
    const actor = c.get("actor");
    if (!actor.userId) {
      return fail(c, 401, "AUTH_REQUIRED", "Sign in before starting checkout.");
    }
    const userId = actor.userId;

    const { cartId, shippingAddress } = c.req.valid("json");
    const hasCartToken = await verifyCartToken(c.env, c.req.header("x-aether-cart-token"), cartId);
    if (!hasCartToken) {
      return fail(c, 401, "CART_TOKEN_REQUIRED", "A valid cart token is required.");
    }

    const cart = await readCart(c.env, cartId);
    if (cart.userId && cart.userId !== userId) {
      return fail(c, 403, "CART_OWNERSHIP_MISMATCH", "This cart belongs to another account.");
    }
    if (cart.items.length === 0) {
      return fail(c, 422, "EMPTY_CART", "Add at least one item before checkout.");
    }

    const settings = await resolveCheckoutSettings(c.env);
    const { mode, provider } = createCheckoutProviderFor(c.env, settings);
    const idempotencyKey = c.req.header("x-idempotency-key");
    if (c.env.AETHER_ENV === "production") {
      if (!idempotencyKey) return fail(c, 400, "IDEMPOTENCY_KEY_REQUIRED", "A checkout request key is required.");
      const active = settings[mode];
      if (!active.secretKey || !active.webhookSecret ||
          (mode === "wompi" && (!c.env.WOMPI_PUBLIC_KEY || !c.env.WOMPI_INTEGRITY_KEY))) {
        return fail(c, 503, "CHECKOUT_NOT_CONFIGURED", "Payments are not configured for this store.");
      }
      const shipping = await createShippingSettingsService(c.env.DB).get(defaultShippingSettings);
      if (shipping.enabled && !shippingAddress && !cart.shippingAddress) {
        return fail(c, 422, "SHIPPING_ADDRESS_REQUIRED", "Add a delivery address before paying.");
      }
    }
    return withIdempotency(c.env.DB, "POST /checkout/session", idempotencyKey,
      { actorId: userId, cartId, shippingAddress: shippingAddress ?? null }, async () => {
    try {
      const quotedCart = await repriceCartForCheckout(c.env, cart);
      for (const productId of new Set(quotedCart.items.map((item) => item.productId))) {
        const product = await getProductById(c.env, productId);
        if (!product) throw new CheckoutQuoteChangedError();
        const quantity = quotedCart.items.filter((item) => item.productId === productId).reduce((sum, item) => sum + item.quantity, 0);
        await upsertActiveReservation(c.env, { cartId, productId, sku: product.sku, quantity });
      }
      await extendCartReservations(c.env, cartId, CHECKOUT_EXTENSION_MINUTES);
      const checkoutCart = await writeCart(c.env, {
        ...quotedCart,
        userId,
        ...(shippingAddress
          ? {
              shippingAddress: {
                ...shippingAddress,
                postalCode: shippingAddress.postalCode || "000000",
                country: getRuntimeStoreConfig(c.env).country
              }
            }
          : {})
      });
      const customerEmail = await resolveActorEmail(c.env, actor);
      // Every provider gets an immutable checkout snapshot. Stripe binds its
      // returned session id here; Wompi Web Checkout carries the snapshot id
      // in its signed reference and resolves it on return or webhook.
      const snapshot = await createCheckoutSnapshot(c.env, checkoutCart, userId);
      const session = await provider.createCheckoutSession(checkoutCart, customerEmail, snapshot.id);
      if (session.sessionId) {
        await bindCheckoutSnapshotToSession(c.env, snapshot.id, session.sessionId);
      }
      return ok(c, { checkoutUrl: session.checkoutUrl }, 201);
    } catch (error) {
      if (error instanceof CheckoutQuoteChangedError) {
        const latest = error.quote ? await writeCart(c.env, error.quote) : undefined;
        return fail(c, 409, "CHECKOUT_QUOTE_CHANGED", error.message, latest ? { cart: latest } : undefined);
      }
      return fail(
        c,
        500,
        "CHECKOUT_SESSION_FAILED",
        `${mode} checkout could not be started. Check its secret key and network access.`
      );
    }
    });
  }
);

checkoutRoutes.post(
  "/confirm",
  zValidator("json", z.object({ sessionId: z.string().min(1) })),
  async (c) => {
    const actor = c.get("actor");
    if (!actor.userId) {
      return fail(c, 401, "AUTH_REQUIRED", "Sign in before confirming checkout.");
    }

    const settings = await resolveCheckoutSettings(c.env);
    const { mode, provider } = createCheckoutProviderFor(c.env, settings);
    try {
      const session = await provider.retrieveCheckoutSession(c.req.valid("json").sessionId);
      if (!session.metadata?.userId || session.metadata.userId !== actor.userId) {
        return fail(c, 403, "CHECKOUT_OWNERSHIP_MISMATCH", "This checkout belongs to another account.");
      }
      if (!isCheckoutSessionPaid(session)) {
        return fail(c, 422, "PAYMENT_NOT_PAID", `${mode} checkout session is not paid yet.`);
      }

      const result = await createOrderFromPaidSession(c.env, session, mode);
      return ok(c, { order: result.order, created: result.created }, result.created ? 201 : 200);
    } catch (error) {
      return fail(
        c,
        500,
        "CHECKOUT_CONFIRM_FAILED",
        error instanceof Error ? error.message : "Checkout confirmation failed."
      );
    }
  }
);
