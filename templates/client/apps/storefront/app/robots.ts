import type { MetadataRoute } from "next";
import { absoluteStorefrontUrl } from "@aether-commerce/storefront-default";
import { storefrontBasePath, storefrontSiteUrl } from "./seo-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    sitemap: absoluteStorefrontUrl(storefrontSiteUrl, "/sitemap.xml", storefrontBasePath)
  };
}
