"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ClientConfiguration } from "@aether-commerce/config-schema";

export type AdminRuntimeConfig = {
  /** Public config (brand, features, ...) - the admin slice of the same ClientConfiguration the storefront package reads (see templates/client/src/adapters.ts's existing "admin" slice: brand/features/api). */
  config: ClientConfiguration;
  /** Resolved API base URL - env resolution stays app-side, since it differs per deployment. */
  apiBaseUrl: string;
  /** Link target for "open storefront" - optional since not every client links a storefront from the admin panel. */
  storefrontUrl?: string;
};

export type AdminStoreCurrency = "USD" | "COP";

const AdminConfigContext = createContext<AdminRuntimeConfig | null>(null);

/** Wraps an admin app (the reference Aether deployment, or a generated client) so every default-skin component reads its brand/API config from here instead of a build-time import. */
export function AetherAdminProvider({ config, apiBaseUrl, storefrontUrl, children }: AdminRuntimeConfig & { children: ReactNode }) {
  return (
    <AdminConfigContext.Provider value={{ config, apiBaseUrl, ...(storefrontUrl !== undefined ? { storefrontUrl } : {}) }}>
      {children}
    </AdminConfigContext.Provider>
  );
}

export function useAdminConfig(): AdminRuntimeConfig {
  const context = useContext(AdminConfigContext);
  if (!context) {
    throw new Error("useAdminConfig must be used within AetherAdminProvider");
  }
  return context;
}

/**
 * Reads the live store currency, including admin-managed settings. The
 * build-time client configuration remains the safe first paint fallback, but
 * money fields must follow the API's current store setting after it loads.
 */
export function useAdminStoreCurrency(): AdminStoreCurrency {
  const { config, apiBaseUrl } = useAdminConfig();
  const configuredCurrency: AdminStoreCurrency = config.store.currency === "COP" ? "COP" : "USD";
  const [currency, setCurrency] = useState<AdminStoreCurrency>(configuredCurrency);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/runtime-config`, {
          cache: "no-store",
          headers: { accept: "application/json" }
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { success?: boolean; data?: { currency?: string } };
        if (!cancelled && payload.success && (payload.data?.currency === "USD" || payload.data?.currency === "COP")) {
          setCurrency(payload.data.currency);
        }
      } catch {
        // Keep the validated build-time currency when the public runtime read
        // is unavailable. The API remains the authority for stored amounts.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, configuredCurrency]);

  return currency;
}
