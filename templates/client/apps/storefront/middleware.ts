import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { catalogRequestStatus } from "@aether-commerce/storefront-default/server";
import { clientConfiguration } from "../../src/configuration";
const apiBaseUrl =
  process.env.NEXT_PUBLIC_AETHER_API_URL ??
  (process.env.NODE_ENV === "development"
    ? clientConfiguration.integrations.api.localBaseUrl
    : clientConfiguration.integrations.api.productionBaseUrl);
const storefrontBasePath = (process.env.NEXT_PUBLIC_AETHER_BASE_PATH || "").replace(/\/$/, "");

// OpenNext Cloudflare supports Edge middleware, not Next's Node proxy yet.
export async function middleware(request: NextRequest) {
  const status = await catalogRequestStatus(
    apiBaseUrl,
    request.nextUrl.pathname,
    storefrontBasePath
  );
  if (status === 200) return NextResponse.next();
  const destination = new URL(request.url);
  destination.pathname = storefrontBasePath + (status === 404 ? "/404/" : "/catalog-unavailable/");
  destination.search = "";
  return NextResponse.rewrite(destination, {
    status,
    headers: { "x-robots-tag": "noindex", ...(status === 503 ? { "retry-after": "60" } : {}) }
  });
}

export const config = { matcher: ["/products/:slug", "/categories/:slug"] };
