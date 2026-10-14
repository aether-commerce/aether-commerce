"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ClientConfiguration } from "@aether-commerce/config-schema";

export type StorefrontRuntimeConfig = {
  /** Public config (brand, theme, store, features, ...) - the same object apps/storefront's reference deployment builds from config/aether/*. */
  config: ClientConfiguration;
  /** Resolved API base URL - env/hostname resolution stays app-side (see apps/storefront/components/config.ts), since it differs per deployment. */
  apiBaseUrl: string;
  /** Resolved AI assistant Worker URL - same app-side resolution reasoning as apiBaseUrl. Undefined/empty means AssistantWidget renders nothing (a client without the assistant configured). */
  aiAssistantUrl?: string;
  /** Next.js basePath, if the app is deployed under a subpath. */
  basePath?: string;
};

type ResolvedStorefrontRuntimeConfig = StorefrontRuntimeConfig & {
  reviewsEnabled: boolean;
  runtimeCurrency: "USD" | "COP" | null;
};

type PublicRuntimeConfigPayload = {
  success: boolean;
  data?: { currency?: unknown };
};

const StorefrontConfigContext = createContext<ResolvedStorefrontRuntimeConfig | null>(null);

/** Wraps a storefront app (the reference Aether deployment, or a generated client) so every default-skin component reads its brand/theme/API config from here instead of a build-time import - a shared package can't have one client's config baked in. */
export function AetherStorefrontProvider({ config, apiBaseUrl, aiAssistantUrl, basePath, children }: StorefrontRuntimeConfig & { children: ReactNode }) {
  const [reviewsEnabled, setReviewsEnabled] = useState(config.features.reviews);
  const [runtimeCurrency, setRuntimeCurrency] = useState<"USD" | "COP" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${apiBaseUrl}/api/v1/brand`)
      .then((response) => response.json())
      .then((payload: { success: boolean; data?: { features?: { reviews?: boolean } } }) => {
        if (!cancelled && payload.success) setReviewsEnabled(config.features.reviews && payload.data?.features?.reviews !== false);
      })
      .catch(() => {
        // Keep the build-time default if the optional runtime settings read fails.
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, config.features.reviews]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${apiBaseUrl}/api/v1/runtime-config`, {
      headers: { accept: "application/json" }
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Runtime store configuration unavailable.");
        return response.json() as Promise<PublicRuntimeConfigPayload>;
      })
      .then((payload) => {
        const currency = payload.data?.currency;
        if (!cancelled && payload.success && (currency === "USD" || currency === "COP")) {
          setRuntimeCurrency(currency);
        }
      })
      .catch(() => {
        // Keep the build-time currency if the optional runtime settings read fails.
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const resolvedConfig = useMemo(
    () => runtimeCurrency ? { ...config, store: { ...config.store, currency: runtimeCurrency } } : config,
    [config, runtimeCurrency]
  );

  const value = useMemo<ResolvedStorefrontRuntimeConfig>(
    () => ({ config: resolvedConfig, apiBaseUrl, reviewsEnabled, runtimeCurrency, ...(aiAssistantUrl !== undefined ? { aiAssistantUrl } : {}), ...(basePath !== undefined ? { basePath } : {}) }),
    [resolvedConfig, apiBaseUrl, reviewsEnabled, runtimeCurrency, aiAssistantUrl, basePath]
  );
  return <StorefrontConfigContext.Provider value={value}>{children}</StorefrontConfigContext.Provider>;
}

export function useStorefrontConfig(): ResolvedStorefrontRuntimeConfig {
  const context = useContext(StorefrontConfigContext);
  if (!context) {
    throw new Error("useStorefrontConfig must be used within AetherStorefrontProvider");
  }
  return context;
}

// Mirrors apps/storefront/components/config.ts's storefrontPath() exactly
// (next.config.mjs's trailingSlash: true means every static page is emitted
// as e.g. /account/index.html, only reliably reachable at /account/), just
// reading basePath from context instead of a static env-var read.
export function useStorefrontPath() {
  const { basePath } = useStorefrontConfig();
  const normalizedBase = (basePath || "").replace(/\/$/, "");
  return function storefrontPath(path = "/"): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const queryIndex = normalizedPath.search(/[?#]/);
    const pathname = queryIndex === -1 ? normalizedPath : normalizedPath.slice(0, queryIndex);
    const suffix = queryIndex === -1 ? "" : normalizedPath.slice(queryIndex);
    const pathnameWithSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return `${normalizedBase}${pathnameWithSlash}${suffix}` || "/";
  };
}
