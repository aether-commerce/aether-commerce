import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { catalogRequestStatus } from "@aether-commerce/storefront-default/server";
import { apiBaseUrl, storefrontBasePath } from "./components/config";

// OpenNext Cloudflare supports Edge middleware, not Next's Node proxy yet.
export async function middleware(request: NextRequest) {
  // This app owns a legacy detail route that redirects to the canonical slug.
  if (request.nextUrl.pathname.replace(/\/+$/, "").endsWith("/products/detail"))
    return NextResponse.next();
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
