import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { encryptSecret } from "@aether-commerce/core";
import type { AppBindings } from "../types";
import { publicRoutes } from "../routes/public";
import { createCheckoutSettingsService } from "./checkout-settings";
import { LEGACY_CHECKOUT_SETTINGS_KEY, PROVIDER_CHECKOUT_SETTINGS_KEY, STOREFRONT_CHECKOUT_OPTIONS_KEY } from "./checkout-settings-keys";

function settingsDb(initial: Record<string, unknown> = {}) {
  const rows = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            first: () => {
              const value_json = rows.get(String(args[0]));
              return Promise.resolve(value_json ? { value_json } : null);
            },
            run: () => {
              expect(sql).toContain("insert into application_settings");
              rows.set(String(args[0]), String(args[1]));
              return Promise.resolve({ success: true });
            }
          };
        }
      };
    }
  } as unknown as D1Database;
  return { db, rows };
}

const app = new Hono<AppBindings>().route("/public", publicRoutes);

async function publicOptions(db: D1Database) {
  const response = await app.request("/public/checkout/options", {}, { DB: db } as AppBindings["Bindings"]);
  expect(response.status).toBe(200);
  return response.json<{ data: Record<string, unknown> }>();
}

describe("checkout settings isolation", () => {
  it("never exposes encrypted provider fields from the legacy public route", async () => {
    const { db } = settingsDb({
      [LEGACY_CHECKOUT_SETTINGS_KEY]: { mode: "wompi", wompi: { secretKey: "encrypted-secret-marker" } }
    });
    const payload = await publicOptions(db);
    expect(payload.data).toEqual({ paymentMode: "stripe", whatsappNumber: "", whatsappMessageTemplate: "" });
    expect(JSON.stringify(payload)).not.toContain("encrypted-secret-marker");
    expect(payload.data).not.toHaveProperty("wompi");
  });

  it("reads legacy storefront options but strips unrecognized fields", async () => {
    const { db } = settingsDb({
      [LEGACY_CHECKOUT_SETTINGS_KEY]: {
        paymentMode: "whatsapp", whatsappNumber: "573001234567", whatsappMessageTemplate: "Hola", secretKey: "must-not-leak"
      }
    });
    const payload = await publicOptions(db);
    expect(payload.data).toEqual({ paymentMode: "whatsapp", whatsappNumber: "573001234567", whatsappMessageTemplate: "Hola" });
    expect(JSON.stringify(payload)).not.toContain("must-not-leak");
  });

  it("keeps new storefront options separate while migrating legacy provider settings on update", async () => {
    const encryptionKey = "test-encryption-key";
    const encrypted = await encryptSecret(encryptionKey, "prv_test_legacy");
    const { db, rows } = settingsDb({
      [LEGACY_CHECKOUT_SETTINGS_KEY]: { mode: "wompi", stripe: {}, wompi: { secretKey: encrypted } },
      [STOREFRONT_CHECKOUT_OPTIONS_KEY]: {
        paymentMode: "whatsapp", whatsappNumber: "573001234567", whatsappMessageTemplate: "Pedido demo"
      }
    });
    const service = createCheckoutSettingsService(db, encryptionKey);
    const fallback = { mode: "stripe" as const, stripe: {}, wompi: {} };
    const before = await service.get(fallback);
    expect(before.mode).toBe("wompi");
    expect(before.wompi.secretKey).toBe("prv_test_legacy");

    await service.update({ mode: "wompi" });
    expect(rows.has(PROVIDER_CHECKOUT_SETTINGS_KEY)).toBe(true);
    expect(JSON.parse(rows.get(STOREFRONT_CHECKOUT_OPTIONS_KEY)!)).toMatchObject({ paymentMode: "whatsapp" });
    const after = await service.get(fallback);
    expect(after.wompi.secretKey).toBe("prv_test_legacy");
    expect((await publicOptions(db)).data).toMatchObject({ paymentMode: "whatsapp" });
  });
});
