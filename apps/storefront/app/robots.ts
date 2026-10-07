import type { MetadataRoute } from "next";
import { absoluteStorefrontUrl } from "@aether-commerce/storefront-default";
import { storefrontSiteUrl } from "./seo-config";
import { storefrontBasePath } from "../components/config";

// These rules depend only on deployment configuration.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    sitemap: absoluteStorefrontUrl(storefrontSiteUrl, "/sitemap.xml", storefrontBasePath)
  };
}
