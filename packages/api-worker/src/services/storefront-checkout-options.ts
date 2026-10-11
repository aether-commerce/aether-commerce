import { defaultCheckoutSettings, isValidWhatsappNumber, type CheckoutSettings } from "@aether-commerce/core";
import { z } from "zod";
import { LEGACY_CHECKOUT_SETTINGS_KEY, STOREFRONT_CHECKOUT_OPTIONS_KEY } from "./checkout-settings-keys";

export const storefrontCheckoutOptionsSchema = z.object({
  paymentMode: z.enum(["stripe", "whatsapp"]),
  whatsappNumber: z.string().max(20),
  whatsappMessageTemplate: z.string().max(500).optional().default("")
}).refine(
  (value) => value.paymentMode !== "whatsapp" || isValidWhatsappNumber(value.whatsappNumber),
  {
    message: "whatsappNumber must be digits only with country code (e.g. 573001234567) when paymentMode is whatsapp",
    path: ["whatsappNumber"]
  }
);

/** Read only the public option fields, even when the legacy row contains encrypted provider keys. */
export async function readStorefrontCheckoutOptions(db: D1Database): Promise<CheckoutSettings> {
  for (const key of [STOREFRONT_CHECKOUT_OPTIONS_KEY, LEGACY_CHECKOUT_SETTINGS_KEY]) {
    const row = await db.prepare("select value_json from application_settings where key = ?")
      .bind(key)
      .first<{ value_json: string }>();
    if (!row) continue;
    try {
      const parsed = storefrontCheckoutOptionsSchema.safeParse(JSON.parse(row.value_json));
      if (parsed.success) return parsed.data;
    } catch {
      // An invalid row is not safe to send to unauthenticated clients.
    }
  }
  return defaultCheckoutSettings;
}
