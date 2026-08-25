import type { Env } from "../types";

const countryPattern = /^[A-Z]{2}$/;

export type RuntimeStoreConfig = {
  currency: "USD" | "COP";
  locale: string;
  country: string;
};

/** Reads safe per-store defaults from Worker vars without trusting malformed values. */
export function getRuntimeStoreConfig(env: Env): RuntimeStoreConfig {
  const currency = env.STORE_CURRENCY?.trim().toUpperCase();
  const country = env.STORE_COUNTRY?.trim().toUpperCase();
  const locale = env.STORE_LOCALE?.trim();

  return {
    currency: currency === "COP" ? "COP" : "USD",
    locale: locale || "en-US",
    country: country && countryPattern.test(country) ? country : "US"
  };
}

/**
 * Resolves the live store setting. Admin-managed values override deploy-time
 * defaults, while malformed or unavailable settings safely fall back to USD.
 */
export async function getStoreConfig(env: Env): Promise<RuntimeStoreConfig> {
  const fallback = getRuntimeStoreConfig(env);
  try {
    const row = await env.DB.prepare("select value_json from application_settings where key = 'store'").first<{ value_json: string }>();
    if (!row) return fallback;
    const value = JSON.parse(row.value_json) as { currency?: unknown };
    return { ...fallback, currency: value.currency === "COP" ? "COP" : value.currency === "USD" ? "USD" : fallback.currency };
  } catch {
    return fallback;
  }
}
