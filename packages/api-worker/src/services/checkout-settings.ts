import { CheckoutSettingsService, type CheckoutProviderCredentials, type CheckoutSettings, type CheckoutSettingsRepository } from "@aether-commerce/api-core";
import { decryptSecret, encryptSecret } from "@aether-commerce/core";
import { LEGACY_CHECKOUT_SETTINGS_KEY, PROVIDER_CHECKOUT_SETTINGS_KEY } from "./checkout-settings-keys";

type StoredCredentials = { secretKey?: string; webhookSecret?: string };
type StoredSettings = { mode?: string; stripe?: StoredCredentials; wompi?: StoredCredentials };

async function encryptCredentials(passphrase: string, credentials: CheckoutProviderCredentials): Promise<StoredCredentials> {
  return {
    ...(credentials.secretKey ? { secretKey: await encryptSecret(passphrase, credentials.secretKey) } : {}),
    ...(credentials.webhookSecret ? { webhookSecret: await encryptSecret(passphrase, credentials.webhookSecret) } : {})
  };
}

/**
 * Best-effort decrypt: a stored value that fails to decrypt (wrong/rotated
 * passphrase, corrupt row) is treated as absent rather than thrown, so a
 * broken settings row degrades to the env-var fallback instead of breaking
 * checkout for customers.
 */
async function decryptCredentials(passphrase: string, stored: StoredCredentials | undefined): Promise<CheckoutProviderCredentials> {
  if (!stored) return {};
  const result: CheckoutProviderCredentials = {};
  if (stored.secretKey) {
    try {
      result.secretKey = await decryptSecret(passphrase, stored.secretKey);
    } catch (error) {
      console.error("Could not decrypt stored checkout secret key", { error: error instanceof Error ? error.name : "unknown" });
    }
  }
  if (stored.webhookSecret) {
    try {
      result.webhookSecret = await decryptSecret(passphrase, stored.webhookSecret);
    } catch (error) {
      console.error("Could not decrypt stored checkout webhook secret", { error: error instanceof Error ? error.name : "unknown" });
    }
  }
  return result;
}

/** D1 adapter for admin-managed checkout provider settings, encrypted at rest. */
export function createCheckoutSettingsService(db: D1Database, encryptionKey: string | undefined): CheckoutSettingsService {
  const repository: CheckoutSettingsRepository = {
    async read() {
      if (!encryptionKey) {
        console.error("AETHER_SETTINGS_ENCRYPTION_KEY is not configured; ignoring stored checkout settings.");
        return null;
      }

      // Read the new private key first. The legacy key is read-only for a
      // gradual rollout; it may contain public storefront options instead.
      for (const key of [PROVIDER_CHECKOUT_SETTINGS_KEY, LEGACY_CHECKOUT_SETTINGS_KEY]) {
        const row = await db.prepare("select value_json from application_settings where key = ?")
          .bind(key)
          .first<{ value_json: string }>();
        if (!row) continue;
        let stored: StoredSettings;
        try {
          stored = JSON.parse(row.value_json) as StoredSettings;
        } catch {
          continue;
        }
        if (stored?.mode !== "stripe" && stored?.mode !== "wompi") continue;
        return {
          mode: stored.mode,
          stripe: await decryptCredentials(encryptionKey, stored.stripe),
          wompi: await decryptCredentials(encryptionKey, stored.wompi)
        } satisfies CheckoutSettings;
      }
      return null;
    },

    async write(settings) {
      if (!encryptionKey) {
        throw new Error("AETHER_SETTINGS_ENCRYPTION_KEY is not configured; cannot store checkout secrets.");
      }

      const stored: StoredSettings = {
        mode: settings.mode,
        stripe: await encryptCredentials(encryptionKey, settings.stripe),
        wompi: await encryptCredentials(encryptionKey, settings.wompi)
      };
      await db
        .prepare(
          `insert into application_settings (key, value_json, updated_at) values (?, ?, CURRENT_TIMESTAMP)
           on conflict(key) do update set value_json = excluded.value_json, updated_at = excluded.updated_at`
        )
        .bind(PROVIDER_CHECKOUT_SETTINGS_KEY, JSON.stringify(stored))
        .run();
    }
  };
  return new CheckoutSettingsService(repository);
}
