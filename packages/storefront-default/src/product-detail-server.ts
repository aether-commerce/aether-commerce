import { cache } from "react";
import type { Product } from "@aether-commerce/schemas";

export type ProductLookup =
  | { status: "found"; product: Product }
  | { status: "not-found" }
  | { status: "unavailable" };

function apiUrl(apiBaseUrl: string, slug: string) {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/products/slug/${encodeURIComponent(slug)}`;
}

/**
 * Loads a product for a server-rendered route. React's request cache means
 * generateMetadata() and the page body share one API request per render.
 * Network failures stay distinct from a missing product so the route does not
 * turn a temporary API outage into a false 404.
 */
export const fetchProductBySlug = cache(async (apiBaseUrl: string, slug: string): Promise<ProductLookup> => {
  if (!apiBaseUrl) return { status: "unavailable" };

  try {
    const response = await fetch(apiUrl(apiBaseUrl, slug), {
      cache: "no-store",
      headers: { accept: "application/json" }
    });
    const payload = (await response.json()) as { success?: boolean; data?: Product };

    if (response.status === 404) {
      return { status: "not-found" };
    }

    if (!response.ok || !payload.success || !payload.data) {
      return { status: "unavailable" };
    }

    return { status: "found", product: payload.data };
  } catch {
    return { status: "unavailable" };
  }
});
