import { buildStorefrontSitemap } from "@aether-commerce/storefront-default";
import { apiBaseUrl, storefrontBasePath } from "../components/config";
import { storefrontSiteUrl } from "./seo-config";

export const dynamic = "force-dynamic";

export default function sitemap() {
  return buildStorefrontSitemap({
    apiBaseUrl: apiBaseUrl,
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
