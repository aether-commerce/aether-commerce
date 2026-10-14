import type { Env } from "../types";
import { recordTaskRun } from "./metrics";
import { sendDueRestockNotifications } from "./restock-notifications";
import { sendLowStockAlerts } from "./low-stock-alerts";

function retentionDays(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(730, Math.max(7, Math.round(parsed))) : fallback;
}

type ScheduledTask = { name: string; run: () => Promise<unknown> };

async function runTask(env: Env, task: ScheduledTask): Promise<boolean> {
  try {
    await task.run();
    await recordTaskRun(env, task.name, "ok");
    return false;
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 200) : "Unknown error";
    await recordTaskRun(env, task.name, "failed", detail);
    return true;
  }
}

// Each maintenance group has its own D1 batch and task_runs key. A failure in
// one group therefore identifies the broken operation and does not prevent
// the other independent cleanup groups or notifications from being checked.
function maintenanceTasks(env: Env): ScheduledTask[] {
  const metricsDays = retentionDays(env.HEALTH_METRICS_RETENTION_DAYS, 90);
  const now = new Date().toISOString();
  const tasks: ScheduledTask[] = [
    {
      name: "inventory_reservation_expiry",
      run: () => env.DB.batch([
        env.DB.prepare(
          "update inventory_reservations set status = 'expired', updated_at = CURRENT_TIMESTAMP where status = 'active' and expires_at < ?"
        ).bind(now)
      ])
    },
    {
      name: "checkout_snapshot_maintenance",
      run: () => env.DB.batch([
        env.DB.prepare("update checkout_snapshots set status = 'expired', updated_at = CURRENT_TIMESTAMP where status = 'active' and datetime(expires_at) <= CURRENT_TIMESTAMP"),
        env.DB.prepare("delete from checkout_snapshots where status != 'active' and updated_at <= datetime('now', '-30 days')")
      ])
    },
    {
      name: "data_retention_cleanup",
      run: () => env.DB.batch([
        env.DB.prepare("delete from webhook_events where created_at <= datetime('now', '-90 days')"),
        env.DB.prepare("delete from operational_metrics where created_at <= datetime('now', ?)").bind(`-${metricsDays} days`),
        env.DB.prepare("delete from audit_logs where created_at <= datetime('now', '-365 days')")
      ])
    },
    {
      name: "admin_chat_retention",
      run: () => env.DB.batch([
        env.DB.prepare(
          "delete from admin_chat_pending_actions where conversation_id in (select id from admin_chat_conversations where updated_at <= datetime('now', '-30 days'))"
        ),
        env.DB.prepare(
          "delete from admin_chat_messages where conversation_id in (select id from admin_chat_conversations where updated_at <= datetime('now', '-30 days'))"
        ),
        env.DB.prepare("delete from admin_chat_conversations where updated_at <= datetime('now', '-30 days')")
      ])
    }
  ];

  return tasks;
}

export async function runScheduledMaintenance(env: Env): Promise<void> {
  const failures = (await Promise.all(maintenanceTasks(env).map((task) => runTask(env, task)))).filter(Boolean);
  if (failures.length > 0) throw new Error(`Scheduled maintenance failed: ${failures.length} task(s)`);
}

// Run every independent scheduled task even when another fails. Each task's
// own row remains visible in System health, while throwing at the end marks
// the scheduled invocation itself as failed in Cloudflare's execution logs.
export async function runScheduledTasks(env: Env): Promise<void> {
  const tasks: ScheduledTask[] = [
    ...maintenanceTasks(env),
    { name: "restock_notifications", run: () => sendDueRestockNotifications(env) },
    { name: "low_stock_alerts", run: () => sendLowStockAlerts(env) }
  ];

  const failures = (await Promise.all(tasks.map((task) => runTask(env, task)))).filter(Boolean);
  if (failures.length > 0) throw new Error(`Scheduled tasks failed: ${failures.length} task(s)`);
}
