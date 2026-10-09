import { describe, expect, it, vi } from "vitest";
import type { Env } from "../types";
import { syncChargeRefunded, syncDisputeCreated, syncRefundUpdated } from "./payment-sync";

type Row = Record<string, unknown> | null;

function fakeDb(rows: { payment?: Row; order?: Row; refund?: Row } = {}) {
  const run = vi.fn(() => Promise.resolve({ success: true, meta: { changes: 1 } }));
  const batch = vi.fn((stmts: unknown[]) => Promise.resolve(stmts.map(() => ({ success: true, meta: { changes: 1 } }))));
  const statements: string[] = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      if (sql.includes("from payments") && sql.includes("provider_")) {
        expect(sql).toContain("provider_ref = ?");
      }
      statements.push(sql);
      return {
        run,
        bind: vi.fn(() => ({
          first: vi.fn(() => {
            if (sql.includes("from refunds r")) return Promise.resolve(rows.refund ?? null);
            if (sql.includes("from payments")) return Promise.resolve(rows.payment ?? null);
            if (sql.includes("from orders")) return Promise.resolve(rows.order ?? null);
            return Promise.resolve(null);
          }),
          all: vi.fn(() => Promise.resolve({ results: [] })),
          run
        })),
        first: vi.fn(() => Promise.resolve(null))
      };
    }),
    batch
  };
  return { env: { DB: db, CONTACT_RECIPIENT_EMAIL: "owner@example.com" } as unknown as Env, db, statements, batch };
}

describe("syncChargeRefunded", () => {
  it("does nothing when the charge has no payment_intent to look up", async () => {
    const { env, batch } = fakeDb();

    await syncChargeRefunded(env, { id: "ch_1" }, "req_1");

    expect(batch).not.toHaveBeenCalled();
  });

  it("does nothing when no Aether order matches the payment intent - not this store's charge", async () => {
    const { env, batch } = fakeDb({ payment: null });

    await syncChargeRefunded(env, { id: "ch_1", payment_intent: "pi_unknown" }, "req_1");

    expect(batch).not.toHaveBeenCalled();
  });

  it("is a no-op when the order is already refunded - avoids double-applying a refund Aether itself already made", async () => {
    const { env, batch } = fakeDb({
      payment: { order_id: "ord_1" },
      order: { channel: "stripe", payment_status: "refunded", total: 5000, stock_restored_at: "2026-01-01T00:00:00.000Z", email: "shopper@example.com", number: "AETH-1" }
    });

    await syncChargeRefunded(env, { id: "ch_1", payment_intent: "pi_1", refunded: true, amount_refunded: 5000 }, "req_1");

    expect(batch).not.toHaveBeenCalled();
  });

  it("applies a full refund found via a still-paid order", async () => {
    const { env, batch } = fakeDb({
      payment: { order_id: "ord_1" },
      order: { channel: "stripe", payment_status: "paid", total: 5000, stock_restored_at: null, email: "shopper@example.com", number: "AETH-1" }
    });

    await syncChargeRefunded(env, { id: "ch_1", payment_intent: "pi_1", refunded: true, amount_refunded: 5000 }, "req_1");

    expect(batch).toHaveBeenCalledTimes(1);
  });

  it("processes a later partial refund after the order is already partially refunded", async () => {
    const { env, batch } = fakeDb({
      payment: { order_id: "ord_1", id: "pay_1", amount: 5000 },
      order: { channel: "stripe", payment_status: "partially_refunded", total: 5000, stock_restored_at: null,
        email: "shopper@example.com", number: "AETH-1" }
    });
    await syncChargeRefunded(env, { id: "ch_1", payment_intent: "pi_1", amount_refunded: 2500 }, "req_2");
    expect(batch).toHaveBeenCalledTimes(1);
  });
});

describe("syncRefundUpdated", () => {
  it("finalizes only the matching pending refund after Stripe confirms it", async () => {
    const { env, statements } = fakeDb({ refund: { amount: 400, order_id: "ord_1" } });
    await syncRefundUpdated(env, { id: "re_1", amount: 400, status: "succeeded" }, "req_1");
    expect(statements.some((sql) => sql.includes("update refunds set status"))).toBe(true);
    expect(statements.some((sql) => sql.includes("insert into audit_logs"))).toBe(true);
  });

  it("refuses a provider event with an amount different from the pending ledger", async () => {
    const { env, statements } = fakeDb({ refund: { amount: 400, order_id: "ord_1" } });
    await expect(syncRefundUpdated(env, { id: "re_1", amount: 500, status: "succeeded" }, "req_1"))
      .rejects.toThrow("differs");
    expect(statements.some((sql) => sql.includes("update refunds set status"))).toBe(false);
  });
});

describe("syncDisputeCreated", () => {
  it("writes an audit log entry and emails the owner even when no matching order is found", async () => {
    const { env, statements } = fakeDb({ payment: null });

    await syncDisputeCreated(env, { id: "dp_1", payment_intent: "pi_missing", reason: "fraudulent" }, "req_1");

    expect(statements.some((sql) => sql.includes("insert into audit_logs"))).toBe(true);
  });

  it("includes the order number when the dispute's payment intent matches a known order", async () => {
    const { env, statements } = fakeDb({
      payment: { order_id: "ord_1" },
      order: { number: "AETH-1" }
    });

    await syncDisputeCreated(env, { id: "dp_1", payment_intent: "pi_1", reason: "fraudulent", status: "needs_response" }, "req_1");

    expect(statements.some((sql) => sql.includes("insert into audit_logs"))).toBe(true);
    expect(statements.some((sql) => sql.includes("from orders"))).toBe(true);
  });
});
