import type { Env } from "../types";
import { createRefund as createStripeRefund } from "./stripe";
import { createWompiRefund } from "./wompi";
import { writeAuditLog } from "./audit";
import { sendOrderEmail } from "./email";
import { resolveCheckoutSettings } from "./checkout-provider";

export type ProviderRefund = {
  id: string;
  status?: string;
  amount?: number;
};

export type ApplyRefundInput = {
  orderId: string;
  channel: string;
  currentPaymentStatus: string;
  totalCents: number;
  stockRestoredAt: string | null;
  email: string;
  number: string;
  amountCents: number | undefined;
  providerRefundId: string;
  reason?: string;
  actorId: string;
  requestId: string;
  source: "admin" | "admin_chat" | "stripe_webhook";
};

const REFUNDABLE_CHANNELS = new Set(["stripe", "wompi"]);

/** Whether a channel's orders can be refunded through a real payment-provider API at all (whatsapp orders cannot - see order lookup docs). */
export function isRefundableChannel(channel: string): boolean {
  return REFUNDABLE_CHANNELS.has(channel);
}

export async function getRefundedAmount(env: Env, orderId: string): Promise<number> {
  const row = await env.DB.prepare(
    "select coalesce(sum(r.amount), 0) as amount from refunds r join payments p on p.id = r.payment_id where p.order_id = ? and r.status = 'succeeded'"
  ).bind(orderId).first<{ amount: number }>();
  return row?.amount ?? 0;
}

/** Routes a refund to the right payment provider behind one call, shared by the REST admin route and the admin-chat tool so neither duplicates the dispatch. */
export async function createProviderRefund(
  env: Env,
  channel: string,
  providerPaymentIntentId: string,
  amountCents: number | undefined,
  orderTotalCents: number,
  idempotencyKey?: string
): Promise<ProviderRefund> {
  const settings = await resolveCheckoutSettings(env);
  if (channel === "wompi") {
    return createWompiRefund(env, providerPaymentIntentId, amountCents, orderTotalCents, settings.wompi.secretKey);
  }
  return createStripeRefund(env, providerPaymentIntentId, amountCents, settings.stripe.secretKey, idempotencyKey);
}

export async function hasPendingRefund(env: Env, orderId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "select r.id from refunds r join payments p on p.id = r.payment_id where p.order_id = ? and r.status = 'pending' limit 1"
  ).bind(orderId).first<{ id: string }>();
  return !!row;
}

/** The same balance and requested amount identify one provider-side operation. */
export function refundIdempotencyKey(orderId: string, remainingCents: number, amountCents: number): string {
  return `aether-refund:${orderId}:${remainingCents}:${amountCents}`;
}

export async function recordPendingRefund(env: Env, orderId: string, refundId: string, amountCents: number, reason: string): Promise<void> {
  const payment = await env.DB.prepare("select id from payments where order_id = ?").bind(orderId).first<{ id: string }>();
  if (!payment) throw new Error("Payment record is missing");
  await env.DB.prepare(
    "insert into refunds (id, payment_id, amount, reason, status) values (?, ?, ?, ?, 'pending') on conflict(id) do nothing"
  ).bind(refundId, payment.id, amountCents, reason).run();
}

/**
 * Applies a refund that has already happened at the payment provider to
 * local order/payment state - the shared tail end of every refund path in
 * this codebase (the admin REST route and the admin-chat tool both call the
 * provider first via createProviderRefund above, then this; the Stripe
 * webhook's charge.refunded handler calls only this, since Stripe already
 * performed the refund itself - see routes/webhooks.ts).
 */
export async function applyRefundLocally(env: Env, input: ApplyRefundInput): Promise<{ paymentStatus: string }> {
  const reason = input.reason ?? `${input.channel}_refund:${input.providerRefundId}`;
  const payment = await env.DB.prepare("select id, amount from payments where order_id = ?").bind(input.orderId)
    .first<{ id: string; amount: number }>();
  if (!payment) throw new Error("Payment record is missing");
  const duplicate = await env.DB.prepare("select id from refunds where id = ?").bind(input.providerRefundId).first<{ id: string }>();
  if (duplicate) return { paymentStatus: input.currentPaymentStatus };
  const sum = await env.DB.prepare("select coalesce(sum(amount), 0) as amount from refunds where payment_id = ? and status = 'succeeded'")
    .bind(payment.id).first<{ amount: number }>();
  const refunded = sum?.amount ?? 0;
  const amount = input.amountCents ?? payment.amount - refunded;
  if (!Number.isInteger(amount) || amount <= 0 || refunded + amount > payment.amount) {
    throw new Error("Refund amount exceeds the remaining payment balance");
  }
  const nextStatus = refunded + amount === payment.amount ? "refunded" : "partially_refunded";
  await env.DB.batch([
    env.DB.prepare("insert into refunds (id, payment_id, amount, reason, status) values (?, ?, ?, ?, 'succeeded')")
      .bind(input.providerRefundId, payment.id, amount, reason),
    // order_status_history's previous_state/new_state columns are plain
    // TEXT (no CHECK against orderStateSchema) - reused here for the
    // payment-status axis's own audit trail rather than adding a new table.
    env.DB.prepare(
      `insert into order_status_history (id, order_id, previous_state, new_state, actor_id, reason, request_id)
       values (?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), input.orderId, input.currentPaymentStatus, nextStatus, input.actorId, reason, input.requestId)
  ]);

  await writeAuditLog(env, {
    actorId: input.actorId,
    action: "order.refunded",
    targetType: "order",
    targetId: input.orderId,
    payload: { paymentStatus: nextStatus, amountCents: amount, providerRefundId: input.providerRefundId, source: input.source }
  });
  await sendOrderEmail(env, { email: input.email, number: input.number, state: nextStatus }).catch(() => {});
  return { paymentStatus: nextStatus };
}
