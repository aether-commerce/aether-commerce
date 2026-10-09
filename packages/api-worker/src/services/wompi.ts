import type { Cart } from "@aether-commerce/schemas";
import { type CheckoutProvider, type CheckoutProviderCredentials, type PaidCheckoutSession, type WompiWebhookPayload } from "@aether-commerce/api-core";
import type { Env } from "../types";
import { timingSafeEqualText } from "./secure-compare";
import { CHECKOUT_PAYMENT_WINDOW_MINUTES } from "./checkout-lifetime";
import { loadCheckoutSnapshot } from "./checkout-snapshots";

type WompiErrorLog = {
  type?: string;
  reason?: string;
};

export function getWompiSecretKeyStatus(secretKey?: string) {
  if (!secretKey) {
    return "missing";
  }

  if (secretKey.startsWith("prv_test_")) {
    return "test_secret";
  }

  if (secretKey.startsWith("prv_prod_")) {
    return "live_secret";
  }

  if (secretKey.startsWith("pub_")) {
    return "publishable_key";
  }

  return "unknown";
}

/** Wompi scopes API base URL to the key's own environment; sandbox keys cannot call production. */
function wompiApiBase(secretKey: string) {
  return secretKey.startsWith("prv_prod_") ? "https://production.wompi.co/v1" : "https://sandbox.wompi.co/v1";
}

function parseWompiError(body: string): WompiErrorLog {
  try {
    const payload = JSON.parse(body) as { error?: { type?: string; reason?: string; messages?: unknown } };
    const reason = payload.error?.reason ?? (payload.error?.messages ? JSON.stringify(payload.error.messages) : undefined);
    return {
      ...(payload.error?.type !== undefined ? { type: payload.error.type } : {}),
      ...(reason !== undefined ? { reason } : {})
    };
  } catch {
    return { reason: body.slice(0, 180) };
  }
}

function storefrontUrl(origin: string, basePath: string | undefined, path: string) {
  const normalizedOrigin = origin.replace(/\/$/, "");
  const normalizedBasePath = basePath?.trim().replace(/^\/?/, "/").replace(/\/$/, "") ?? "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedOrigin}${normalizedBasePath === "/" ? "" : normalizedBasePath}${normalizedPath}`;
}

const WOMPI_STATUS_TO_NEUTRAL: Record<string, PaidCheckoutSession["status"]> = {
  APPROVED: "paid",
  PENDING: "pending",
  DECLINED: "failed",
  VOIDED: "failed",
  ERROR: "failed"
};

/** Raw Wompi transaction shape, mapped into PaidCheckoutSession before leaving this module. */
type WompiTransactionResponse = {
  id: string;
  status?: string;
  amount_in_cents?: number;
  currency?: string;
  reference?: string;
  customer_email?: string;
  payment_link_id?: string;
};

export function mapWompiTransactionToPaidCheckoutSession(transaction: WompiTransactionResponse): PaidCheckoutSession {
  const reference = transaction.reference ?? "";
  const snapshotReference = reference.match(/^[dp]_(chk_[0-9a-f-]{36})$/);
  const [cartId, userId, checkoutSnapshotId] = snapshotReference ? ["", "", snapshotReference[1]] : reference.split("::");
  return {
    id: transaction.id,
    status: (transaction.status && WOMPI_STATUS_TO_NEUTRAL[transaction.status]) || "unknown",
    ...(transaction.amount_in_cents !== undefined ? { amountTotal: transaction.amount_in_cents } : {}),
    ...(transaction.currency ? { currency: transaction.currency } : {}),
    ...(transaction.customer_email ? { customerEmail: transaction.customer_email } : {}),
    ...(cartId || checkoutSnapshotId
      ? { metadata: { ...(cartId ? { cartId } : {}), ...(userId ? { userId } : {}), ...(checkoutSnapshotId ? { checkoutSnapshotId } : {}) } }
      : {}),
    providerReference: transaction.id
  };
}

export function wompiReferenceEnvironment(reference: string | undefined): "development" | "production" | null {
  if (reference?.startsWith("d_chk_")) return "development";
  if (reference?.startsWith("p_chk_")) return "production";
  return null;
}

export async function enrichWompiSessionFromSnapshot(env: Env, session: PaidCheckoutSession): Promise<PaidCheckoutSession> {
  const snapshotId = session.metadata?.checkoutSnapshotId;
  if (!snapshotId || session.metadata?.cartId) return session;
  const snapshot = await loadCheckoutSnapshot(env, snapshotId);
  if (!snapshot) throw new Error("Wompi checkout snapshot is missing");
  return { ...session, metadata: { cartId: snapshot.cartId, userId: snapshot.userId, checkoutSnapshotId: snapshotId } };
}

// Web Checkout preserves this compact reference. The environment prefix lets
// one sandbox Wompi webhook safely dispatch to the matching Aether database.
function wompiReference(env: Env, checkoutSnapshotId: string): string {
  return `${env.AETHER_ENV === "production" ? "p" : "d"}_${checkoutSnapshotId}`;
}

async function createWompiCheckoutSession(
  env: Env,
  publicKey: string | undefined,
  integrityKey: string | undefined,
  cart: Cart,
  checkoutSnapshotId: string,
  customerEmail?: string
): Promise<{ checkoutUrl: string }> {
  const origin = env.APP_ORIGIN_STORE ?? "http://localhost:3000";
  const simulatedCheckout = {
    checkoutUrl: storefrontUrl(
      origin,
      env.APP_STORE_BASE_PATH,
      `/checkout/success?checkout=simulated&cart=${encodeURIComponent(cart.id)}`
    )
  };

  if ((!publicKey || !integrityKey) && env.AETHER_ENV === "production") {
    throw new Error("Wompi is not configured");
  }
  if (!publicKey || !integrityKey) {
    return simulatedCheckout;
  }
  if (!/^pub_(test|prod)_/.test(publicKey) || !/^(test|prod)_integrity_/.test(integrityKey) ||
      (publicKey.startsWith("pub_test_") !== integrityKey.startsWith("test_integrity_"))) {
    throw new Error("Wompi public and integrity keys must belong to the same environment");
  }
  if (!/^chk_[0-9a-f-]{36}$/.test(checkoutSnapshotId)) {
    throw new Error("A valid checkout snapshot is required for Wompi");
  }

  const amountInCents = cart.totals.total;
  if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
    throw new Error("Checkout total must be a positive amount");
  }
  if (cart.totals.currency.toUpperCase() !== "COP") {
    throw new Error("Wompi checkout requires COP currency");
  }
  const reference = wompiReference(env, checkoutSnapshotId);
  const currency = "COP";
  const expiresAt = new Date(Date.now() + CHECKOUT_PAYMENT_WINDOW_MINUTES * 60_000).toISOString();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${reference}${amountInCents}${currency}${expiresAt}${integrityKey}`));
  const signature = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const redirectUrl = storefrontUrl(
    origin,
    env.APP_STORE_BASE_PATH,
    `/checkout/success?checkout=success&cart=${encodeURIComponent(cart.id)}&provider=wompi`
  );

  const url = new URL("https://checkout.wompi.co/p/");
  url.searchParams.set("public-key", publicKey);
  url.searchParams.set("currency", currency);
  url.searchParams.set("amount-in-cents", String(amountInCents));
  url.searchParams.set("reference", reference);
  url.searchParams.set("signature:integrity", signature);
  url.searchParams.set("expiration-time", expiresAt);
  url.searchParams.set("redirect-url", redirectUrl);
  if (customerEmail) url.searchParams.set("customer-data:email", customerEmail);
  return { checkoutUrl: url.toString() };
}

async function retrieveWompiCheckoutSession(env: Env, secretKey: string | undefined, transactionId: string): Promise<PaidCheckoutSession> {
  if (!secretKey) {
    throw new Error("Wompi secret key is not configured");
  }

  const response = await fetch(`${wompiApiBase(secretKey)}/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { authorization: `Bearer ${secretKey}` }
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("Wompi transaction retrieval failed", {
      status: response.status,
      statusText: response.statusText,
      wompiError: parseWompiError(errorBody)
    });
    throw new Error("Wompi transaction could not be retrieved");
  }

  const payload: { data: WompiTransactionResponse } = await response.json();
  const referenceEnvironment = wompiReferenceEnvironment(payload.data.reference);
  if (referenceEnvironment && referenceEnvironment !== (env.AETHER_ENV === "production" ? "production" : "development")) {
    throw new Error("Wompi transaction belongs to another environment");
  }
  return enrichWompiSessionFromSnapshot(env, mapWompiTransactionToPaidCheckoutSession(payload.data));
}

export type WompiRefund = {
  id: string;
  status?: string;
};

/**
 * Wompi's public API only exposes a full-transaction void
 * (POST /transactions/{id}/void), not a partial-amount refund like Stripe's
 * /v1/refunds - voiding reverses the entire charge. A partial amount is
 * rejected up front instead of silently voiding the full order, so the
 * admin isn't surprised by a mismatch between what they asked for and what
 * actually happened.
 */
export async function createWompiRefund(env: Env, transactionId: string, amountCents: number | undefined, orderTotalCents: number, secretKey = env.WOMPI_SECRET_KEY): Promise<WompiRefund> {
  if (!secretKey) {
    throw new Error("Wompi secret key is not configured");
  }
  if (amountCents !== undefined && amountCents < orderTotalCents) {
    throw new Error("Wompi only supports full refunds - partial refund amounts are not available for Wompi orders.");
  }

  const response = await fetch(`${wompiApiBase(secretKey)}/transactions/${encodeURIComponent(transactionId)}/void`, {
    method: "POST",
    headers: { authorization: `Bearer ${secretKey}` }
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("Wompi refund (void) failed", {
      status: response.status,
      statusText: response.statusText,
      wompiError: parseWompiError(errorBody)
    });
    throw new Error("Wompi refund could not be created");
  }

  const payload: { data?: WompiTransactionResponse } = await response.json();
  if (payload.data?.id !== transactionId || payload.data.status !== "VOIDED") {
    throw new Error("Wompi did not confirm that the transaction was voided");
  }
  return { id: payload.data.id, status: payload.data.status };
}

/** Cloudflare/Wompi adapter for the provider-neutral checkout port. Credentials fall back to env vars when omitted. */
export function createWompiCheckoutProvider(env: Env, credentials?: CheckoutProviderCredentials): CheckoutProvider {
  const secretKey = credentials?.secretKey ?? env.WOMPI_SECRET_KEY;
  return {
    createCheckoutSession: (cart, customerEmail, checkoutSnapshotId) =>
      createWompiCheckoutSession(env, env.WOMPI_PUBLIC_KEY, env.WOMPI_INTEGRITY_KEY, cart, checkoutSnapshotId ?? "", customerEmail),
    retrieveCheckoutSession: (transactionId) => retrieveWompiCheckoutSession(env, secretKey, transactionId)
  };
}

/**
 * Verifies a Wompi event webhook. Wompi signs by concatenating the values the
 * event names in signature.properties (dot-paths into `data`), the event
 * timestamp, and the shared events secret, then SHA-256 hashing the result -
 * a materially different scheme from Stripe's HMAC signature, which is
 * exactly the kind of provider-shaped difference the checkout port exists to
 * absorb behind one interface.
 */
export async function verifyWompiSignature(secret: string, event: WompiWebhookPayload): Promise<boolean> {
  const properties = event.signature?.properties;
  const checksum = event.signature?.checksum;
  if (!properties || !checksum || event.timestamp === undefined) {
    return false;
  }

  const values = properties.map((path) => {
    const segments = path.split(".");
    let cursor: unknown = event.data;
    for (const segment of segments) {
      if (cursor && typeof cursor === "object" && segment in cursor) {
        cursor = (cursor as Record<string, unknown>)[segment];
      } else {
        cursor = undefined;
        break;
      }
    }
    return typeof cursor === "string" || typeof cursor === "number" || typeof cursor === "boolean" ? String(cursor) : null;
  });

  if (values.some((value) => value === null)) return false;

  const concatenated = `${values.join("")}${event.timestamp}${secret}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(concatenated));
  const actual = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return timingSafeEqualText(actual, checksum.toLowerCase());
}
