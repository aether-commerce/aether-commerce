import { buildStorefrontSitemap } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../src/configuration";
import { storefrontBasePath, storefrontSiteUrl } from "./seo-config";

export const dynamic = "force-dynamic";

export default function sitemap() {
  return buildStorefrontSitemap({
    apiBaseUrl:
      process.env.NEXT_PUBLIC_AETHER_API_URL ??
      clientConfiguration.integrations.api.productionBaseUrl,
    siteUrl: storefrontSiteUrl,
    basePath: storefrontBasePath,
    staticPaths: [
      "/",
      "/products",
      "/categories",
      "/deals",
      "/featured",
      "/new-arrivals",
      "/contact",
      "/shipping",
      "/returns",
      "/terms",
      "/privacy",
      "/cookies"
    ]
  });
}
