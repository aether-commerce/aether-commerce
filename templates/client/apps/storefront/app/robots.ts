import type { MetadataRoute } from "next";
import { absoluteStorefrontUrl } from "@aether-commerce/storefront-default";
import { storefrontSiteUrl } from "./seo-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account/", "/checkout/", "/cart/", "/login/", "/register/"]
    },
    sitemap: absoluteStorefrontUrl(storefrontSiteUrl, "/sitemap.xml")
  };
}
