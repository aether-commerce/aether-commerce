import { DEFAULT_HEALTH_THRESHOLDS, evaluateSystemHealth, type SystemHealthResult } from "@aether-commerce/core";
import type { Env } from "../types";
import { averageLatencyMs, sumMetric, type TaskRunRow } from "./metrics";

function minutesSince(isoOrSqliteTimestamp: string): number {
  const normalized = isoOrSqliteTimestamp.includes("T") ? isoOrSqliteTimestamp : `${isoOrSqliteTimestamp.replace(" ", "T")}Z`;
  return Math.max(0, Math.round((Date.now() - new Date(normalized).getTime()) / 60_000));
}

export type BlockedOrderSummary = {
  id: string;
  number: string;
  email: string;
  state: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  blockedMinutes: number;
  href: string;
};

export type SystemHealthSnapshot = {
  status: SystemHealthResult["level"];
  components: SystemHealthResult["components"];
  stats: {
    errors24h: number;
    webhooksFailed24h: number;
    paymentsFailed24h: number;
    adminFailedAttempts1h: number;
    negativeInventoryCount: number;
    blockedOrdersCount: number;
    // Oldest-first, capped - the component-level "orders" status is driven
    // by blockedOrders[0] (the single oldest), but an operator investigating
    // "which order" needs to see all of them, not just the worst one.
    blockedOrders: BlockedOrderSummary[];
    avgLatencyMs: number | null;
    criticalTasks: CriticalTaskSummary[];
    lastCriticalTask: { name: string; lastRunAt: string; status: "ok" | "failed" } | null;
  };
  timestamp: string;
};

const MAX_BLOCKED_ORDERS_LISTED = 5;
const CRITICAL_TASK_NAMES = [
  "inventory_reservation_expiry",
  "checkout_snapshot_maintenance",
  "data_retention_cleanup",
  "admin_chat_retention",
  "restock_notifications",
  "low_stock_alerts"
] as const;
type CriticalTaskSummary = { name: string; lastRunAt: string | null; status: "ok" | "failed" | null };

// Single source of truth for "is the system healthy" - GET /admin/system-health
// (the REST endpoint the admin panel polls) and the admin-chat get_system_health
// tool both call this instead of each running their own copy of these
// queries, so the two can never silently disagree with each other.
export async function computeSystemHealth(env: Env): Promise<SystemHealthSnapshot> {
  const [recentWebhooks, blockedOrderRows, blockedOrderCount, negativeInventory, avgLatencyMs, taskRunsResult, orphanedWompiPayment, errors24h, webhooksFailed24h, paymentsFailed24h, adminFailedAttempts1h] =
    await Promise.all([
      env.DB.prepare("select status from webhook_events order by created_at desc limit 10").all<{ status: string }>(),
      env.DB.prepare(
        `select id, number, email, state, total, currency, payment_status, fulfillment_status, created_at from orders
         where payment_status = 'paid' and fulfillment_status = 'unfulfilled'
         order by created_at asc limit ?`
      )
        .bind(MAX_BLOCKED_ORDERS_LISTED)
        .all<{
          id: string;
          number: string;
          email: string;
          state: string;
          total: number;
          currency: string;
          payment_status: string;
          fulfillment_status: string;
          created_at: string;
        }>(),
      env.DB.prepare("select count(*) as count from orders where payment_status = 'paid' and fulfillment_status = 'unfulfilled'").first<{ count: number }>(),
      env.DB.prepare("select count(*) as count from products where stock < 0").first<{ count: number }>(),
      averageLatencyMs(env, "admin", 1),
      env.DB.prepare(`select task_name, last_run_at, status from task_runs where task_name in (${CRITICAL_TASK_NAMES.map(() => "?").join(", ")})`)
        .bind(...CRITICAL_TASK_NAMES)
        .all<TaskRunRow>(),
      env.DB.prepare(
        `select 1 as found from webhook_events e
         where e.provider = 'wompi'
           and json_extract(e.payload_json, '$.event') = 'transaction.updated'
           and json_extract(e.payload_json, '$.transactionStatus') = 'APPROVED'
           and e.created_at >= datetime('now', '-30 days')
           and (
             e.status in ('failed', 'retrying') or
             (e.status = 'processing' and e.processing_started_at <= datetime('now', '-10 minutes')) or
             (e.status = 'received' and e.created_at <= datetime('now', '-10 minutes'))
           )
           and not exists (
             select 1 from orders o where o.id = 'ord_' || json_extract(e.payload_json, '$.transactionId')
           )
         limit 1`
      ).first<{ found: number }>(),
      sumMetric(env, "application_errors", 24),
      sumMetric(env, "webhooks_failed", 24),
      sumMetric(env, "payments_failed", 24),
      sumMetric(env, "admin_failed_attempts", 1)
    ]);

  const taskRuns = taskRunsResult.results ?? [];
  const criticalTask = [...taskRuns].sort((a, b) => {
    if (a.status !== b.status) return a.status === "failed" ? -1 : 1;
    return a.last_run_at.localeCompare(b.last_run_at);
  })[0] ?? null;
  const failedCriticalTasks = CRITICAL_TASK_NAMES.flatMap((name) => taskRuns.filter((task) => task.task_name === name && task.status === "failed"));
  const criticalTasks: CriticalTaskSummary[] = CRITICAL_TASK_NAMES.map((name) => {
    const task = taskRuns.find((row) => row.task_name === name);
    return { name, lastRunAt: task?.last_run_at ?? null, status: task?.status ?? null };
  });

  const blockedOrders: BlockedOrderSummary[] = (blockedOrderRows.results ?? []).map((row) => ({
    id: row.id,
    number: row.number,
    email: row.email,
    state: row.state,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    totalCents: row.total,
    currency: row.currency,
    createdAt: row.created_at,
    blockedMinutes: minutesSince(row.created_at),
    href: `/orders/detail/?id=${encodeURIComponent(row.id)}`
  }));
  const oldestBlockedOrder = blockedOrders[0];

  let consecutiveWebhookFailures = 0;
  for (const row of recentWebhooks.results) {
    if (row.status !== "failed") break;
    consecutiveWebhookFailures += 1;
  }

  const result = evaluateSystemHealth(
    {
      // No request-volume baseline is tracked, so a true error *rate*
      // (errors / total requests) can't be computed - see stats.errors24h
      // below for the honest absolute-count alternative instead of
      // faking a percentage.
      errorRatePct: null,
      latencyP95Ms: avgLatencyMs, // approximate mean, not a true p95 - see services/metrics.ts
      consecutiveWebhookFailures,
      // Authenticated approved Wompi callbacks that remain unresolved are
      // checked against the local order id. A payment whose webhook never
      // arrives requires provider-side polling and cannot be inferred locally.
      paymentSucceededWithoutLocalOrder: Boolean(orphanedWompiPayment),
      negativeInventoryCount: negativeInventory?.count ?? 0,
      oldestPaidOrderBlockedMinutes: oldestBlockedOrder ? oldestBlockedOrder.blockedMinutes : null,
      recentAdminFailedAttempts: adminFailedAttempts1h,
      criticalTaskFailed: failedCriticalTasks.length > 0,
      criticalTaskName: failedCriticalTasks.map((task) => task.task_name).join(", ") || null,
      criticalTaskStaleMinutes: criticalTask ? minutesSince(criticalTask.last_run_at) : null
    },
    DEFAULT_HEALTH_THRESHOLDS
  );

  return {
    status: result.level,
    components: result.components,
    stats: {
      errors24h,
      webhooksFailed24h,
      paymentsFailed24h,
      adminFailedAttempts1h,
      negativeInventoryCount: negativeInventory?.count ?? 0,
      blockedOrdersCount: blockedOrderCount?.count ?? 0,
      blockedOrders,
      avgLatencyMs,
      criticalTasks,
      lastCriticalTask: criticalTask
        ? { name: criticalTask.task_name, lastRunAt: criticalTask.last_run_at, status: criticalTask.status }
        : null
    },
    timestamp: new Date().toISOString()
  };
}
