import type { MetadataRoute } from "next";
import { absoluteStorefrontUrl } from "@aether-commerce/storefront-default";
import { storefrontSiteUrl } from "./seo-config";

// output: "export" (next.config.mjs) requires every dynamic-looking route -
// robots.txt included - to explicitly opt into static generation (see
// sitemap.ts's matching comment; confirmed live the build fails without it).
export const dynamic = "force-static";

// Same origin layout.tsx's own metadataBase already hardcodes - kept
// consistent rather than introducing a second source of truth for it.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private/transactional pages with no unique content for a crawler to
      // index - a signed-out visitor sees the same login wall on every one.
      disallow: ["/account/", "/checkout/", "/cart/", "/login/", "/register/"]
    },
    sitemap: absoluteStorefrontUrl(storefrontSiteUrl, "/sitemap.xml")
  };
}
