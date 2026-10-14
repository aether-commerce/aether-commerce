import { describe, expect, it } from "vitest";
import type { Env } from "../types";
import { computeSystemHealth } from "./system-health";

function healthEnv(options: { taskRuns?: Array<Record<string, unknown>>; orphanedWompiPayment?: boolean } = {}) {
  const statements: string[] = [];
  const db = {
    prepare(sql: string) {
      statements.push(sql);
      return {
        bind() {
          return {
            all: () => Promise.resolve({ results: sql.includes("from task_runs") ? options.taskRuns ?? [] : [] }),
            first: () => Promise.resolve().then(() => {
              if (sql.includes("json_extract(e.payload_json")) return options.orphanedWompiPayment ? { found: 1 } : null;
              if (sql.includes("count(*)")) return { count: 0 };
              return { total: 0 };
            })
          };
        },
        all: () => Promise.resolve({ results: [] }),
        first: () => Promise.resolve().then(() => {
          if (sql.includes("count(*)")) return { count: 0 };
          return { total: 0 };
        })
      };
    }
  };
  return { env: { DB: db } as unknown as Env, statements };
}

describe("computeSystemHealth", () => {
  it("marks an unresolved approved Wompi callback without a local order as critical", async () => {
    const { env, statements } = healthEnv({ orphanedWompiPayment: true });

    const snapshot = await computeSystemHealth(env);

    expect(snapshot.components.orders).toEqual({ level: "critical", reason: "A successful payment has no matching local order" });
    expect(snapshot.status).toBe("critical");
    expect(statements.some((sql) => sql.includes("json_extract(e.payload_json, '$.transactionStatus') = 'APPROVED'") && sql.includes("not exists"))).toBe(true);
  });

  it("identifies which scheduled task failed and degrades health", async () => {
    const { env } = healthEnv({ taskRuns: [
      { task_name: "data_retention_cleanup", last_run_at: new Date().toISOString(), status: "failed" },
      { task_name: "admin_chat_retention", last_run_at: new Date().toISOString(), status: "failed" }
    ] });

    const snapshot = await computeSystemHealth(env);

    expect(snapshot.components.scheduledTasks).toEqual({ level: "degraded", reason: "Scheduled task data_retention_cleanup, admin_chat_retention failed" });
    expect(snapshot.stats.lastCriticalTask).toMatchObject({ name: "data_retention_cleanup", status: "failed" });
    expect(snapshot.stats.criticalTasks.find((task) => task.name === "low_stock_alerts")).toMatchObject({ name: "low_stock_alerts", status: null });
  });
});
