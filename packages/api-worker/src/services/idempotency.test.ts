import { describe, expect, it, vi } from "vitest";
import { withIdempotency } from "./idempotency";

function fakeDb() {
  const rows = new Map<string, { request_hash: string; response_json: string | null }>();
  return {
    prepare(sql: string) {
      let args: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) { args = values; return statement; },
        first() { return Promise.resolve(rows.get(String(args[0])) ?? null); },
        run() {
          if (sql.startsWith("insert into idempotency_keys")) {
            const key = String(args[0]);
            if (rows.has(key)) return Promise.resolve({ meta: { changes: 0 } });
            rows.set(key, { request_hash: String(args[2]), response_json: null });
          }
          if (sql.startsWith("update idempotency_keys")) {
            const row = rows.get(String(args[1]));
            if (row) row.response_json = String(args[0]);
          }
          return Promise.resolve({ meta: { changes: 1 } });
        }
      };
      return statement;
    }
  } as unknown as D1Database;
}

describe("withIdempotency", () => {
  it("runs a concurrent checkout request only once and replays its final response", async () => {
    const db = fakeDb();
    const run = vi.fn();
    let start!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => { start = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    run.mockImplementation(async () => {
      start();
      await gate;
      return Response.json({ success: true, data: { checkoutUrl: "https://checkout.example.test/1" } }, { status: 201 });
    });
    const input = { actorId: "user_1", cartId: "cart_1" };
    const first = withIdempotency(db, "POST /checkout/session", "key_1", input, run);
    await started;
    const competing = await withIdempotency(db, "POST /checkout/session", "key_1", input, run);
    expect(competing.status).toBe(409);
    expect(await competing.text()).toContain("IDEMPOTENCY_IN_PROGRESS");
    expect(run).toHaveBeenCalledTimes(1);
    release();
    expect((await first).status).toBe(201);
    const replay = await withIdempotency(db, "POST /checkout/session", "key_1", input, run);
    expect(replay.headers.get("x-idempotent-replay")).toBe("true");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
