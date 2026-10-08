import type { StripeWebhookPayload } from "@aether-commerce/api-core";
import type { Env } from "../types";
import { applyRefundLocally } from "./refunds";
import { writeAuditLog } from "./audit";
import { sendDisputeAlertEmail } from "./email";

type StripeChargeOrDispute = NonNullable<NonNullable<StripeWebhookPayload["data"]>["object"]>;

type OrderForSync = {
  channel: string;
  payment_status: string;
  total: number;
  stock_restored_at: string | null;
  email: string;
  number: string;
};

async function findOrderIdByPaymentIntent(env: Env, paymentIntentId: string): Promise<string | null> {
  const payment = await env.DB.prepare("select order_id from payments where provider_ref = ?").bind(paymentIntentId).first<{ order_id: string }>();
  return payment?.order_id ?? null;
}

/**
 * Syncs a refund issued directly in Stripe's own dashboard (not through
 * Aether's admin panel or admin chat) back to the local order - without
 * this, that order stays "paid" forever with no record of what actually
 * happened to the customer's money. Idempotent against a refund Aether
 * itself already applied: compare Stripe's cumulative refunded amount with
 * the immutable local refund ledger before recording any new delta.
 */
export async function syncChargeRefunded(env: Env, charge: StripeChargeOrDispute, requestId: string): Promise<void> {
  if (!charge.payment_intent) return;
  const orderId = await findOrderIdByPaymentIntent(env, charge.payment_intent);
  if (!orderId) return;

  const order = await env.DB.prepare(
    "select channel, payment_status, total, stock_restored_at, email, number from orders where id = ?"
  )
    .bind(orderId)
    .first<OrderForSync>();
  if (!order || order.payment_status === "refunded") return;

  const amountRefunded = charge.amount_refunded;
  if (amountRefunded === undefined || amountRefunded <= 0) return;
  const refunded = await env.DB.prepare(
    "select coalesce(sum(r.amount), 0) as amount from refunds r join payments p on p.id = r.payment_id where p.order_id = ? and r.status = 'succeeded'"
  ).bind(orderId).first<{ amount: number }>();
  const delta = Math.min(order.total, amountRefunded) - (refunded?.amount ?? 0);
  if (delta <= 0) return;

  await applyRefundLocally(env, {
    orderId,
    channel: order.channel,
    currentPaymentStatus: order.payment_status,
    totalCents: order.total,
    stockRestoredAt: order.stock_restored_at,
    email: order.email,
    number: order.number,
    amountCents: delta,
    providerRefundId: `${charge.id}:${amountRefunded}`,
    reason: "stripe_webhook:charge.refunded",
    actorId: "stripe",
    requestId,
    source: "stripe_webhook"
  });
  await env.DB.prepare(
    "update refunds set status = 'reconciled', updated_at = CURRENT_TIMESTAMP where status = 'pending' and payment_id in (select id from payments where order_id = ?)"
  ).bind(orderId).run();
}

/** Finalizes a refund Aether recorded as pending when Stripe later confirms it. */
export async function syncRefundUpdated(env: Env, refund: StripeChargeOrDispute, requestId: string): Promise<void> {
  if (refund.status !== "succeeded" && refund.status !== "failed" && refund.status !== "canceled") return;
  const row = await env.DB.prepare(
    `select r.amount, p.order_id from refunds r join payments p on p.id = r.payment_id
     where r.id = ? and r.status = 'pending'`
  ).bind(refund.id).first<{ amount: number; order_id: string }>();
  if (!row) return;
  if (refund.amount !== undefined && refund.amount !== row.amount) {
    throw new Error("Provider refund amount differs from pending refund ledger");
  }
  const status = refund.status === "succeeded" ? "succeeded" : "failed";
  const result = await env.DB.prepare(
    "update refunds set status = ?, updated_at = CURRENT_TIMESTAMP where id = ? and status = 'pending'"
  ).bind(status, refund.id).run();
  if (!result.meta.changes) return;
  await writeAuditLog(env, {
    actorId: "stripe", action: status === "succeeded" ? "order.refunded" : "order.refund_failed",
    targetType: "order", targetId: row.order_id,
    payload: { providerRefundId: refund.id, amountCents: row.amount, requestId, source: "stripe_webhook" }
  });
}

/**
 * A dispute isn't a refund (no payment_status value represents it - money
 * is contested, not necessarily returned), so this only makes the dispute
 * visible where it would otherwise go unnoticed until Stripe's evidence
 * deadline passed: an audit_logs entry and an email to the store owner.
 */
export async function syncDisputeCreated(env: Env, dispute: StripeChargeOrDispute, requestId: string): Promise<void> {
  const orderId = dispute.payment_intent ? await findOrderIdByPaymentIntent(env, dispute.payment_intent) : null;
  const order = orderId
    ? await env.DB.prepare("select number from orders where id = ?").bind(orderId).first<{ number: string }>()
    : null;

  await writeAuditLog(env, {
    actorId: "stripe",
    action: "order.disputed",
    targetType: "order",
    targetId: orderId,
    payload: { disputeId: dispute.id, requestId, reason: dispute.reason ?? null, status: dispute.status ?? null, source: "stripe_webhook" }
  });
  await sendDisputeAlertEmail(env, {
    disputeId: dispute.id,
    orderNumber: order?.number ?? null,
    ...(dispute.reason !== undefined ? { reason: dispute.reason } : {})
  }).catch(() => {});
}
