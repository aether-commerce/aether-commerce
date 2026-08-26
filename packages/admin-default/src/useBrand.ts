"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useAdminConfig } from "./AetherAdminProvider";

export type AdminBrand = { name: string; logoUrl: string; features?: { reviews?: boolean } };

const brandCacheKey = "aether.admin.brand.v1";

// Public brand read (same unauthenticated endpoint the storefront uses) so
// the sidebar/drawer/top bar glyph can show the real uploaded logo instead of
// the generic Sparkles mark. Cached to localStorage and applied via
// useLayoutEffect (before paint) so a repeat visit shows the real logo
// immediately instead of a Sparkles-then-logo flash on every reload.
export function useBrand(): AdminBrand | null {
  const { apiBaseUrl } = useAdminConfig();
  const [brand, setBrand] = useState<AdminBrand | null>(null);

  useLayoutEffect(() => {
    try {
      const cached = window.localStorage.getItem(brandCacheKey);
      if (cached) setBrand(JSON.parse(cached) as AdminBrand);
    } catch {
      // Ignore malformed/inaccessible cache - the fetch below still runs.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${apiBaseUrl}/api/v1/brand`)
      .then((response) => response.json())
      .then((payload: { success: boolean; data?: AdminBrand }) => {
        if (cancelled || !payload.success || !payload.data) return;
        setBrand(payload.data);
        try {
          window.localStorage.setItem(brandCacheKey, JSON.stringify(payload.data));
        } catch {
          // Storage may be unavailable (private browsing, quota) - non-fatal.
        }
      })
      .catch(() => {
        // Sparkles glyph fallback stays in place if this read fails.
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  return brand;
}
