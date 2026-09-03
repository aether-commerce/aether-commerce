import type { MetadataRoute } from "next";
import { absoluteStorefrontUrl, fetchAllCatalogProducts, fetchCatalogCategories } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../src/configuration";
import { storefrontSiteUrl } from "./seo-config";

const staticPaths = [
  ["/", 1],
  ["/products/", 0.9],
  ["/categories/", 0.7],
  ["/deals/", 0.7],
  ["/featured/", 0.7],
  ["/new-arrivals/", 0.7],
  ["/contact/", 0.3],
  ["/shipping/", 0.3],
  ["/returns/", 0.3],
  ["/terms/", 0.2],
  ["/privacy/", 0.2],
  ["/cookies/", 0.2]
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const apiBaseUrl = clientConfiguration.integrations.api.productionBaseUrl;
  const [products, categories] = await Promise.all([fetchAllCatalogProducts(apiBaseUrl), fetchCatalogCategories(apiBaseUrl)]);
  const staticEntries = staticPaths.map(([path, priority]) => ({
    url: absoluteStorefrontUrl(storefrontSiteUrl, path),
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority
  })) satisfies MetadataRoute.Sitemap;
  const categoryEntries = (categories ?? []).map((category) => ({
    url: absoluteStorefrontUrl(storefrontSiteUrl, `/categories/${category.slug}`),
    changeFrequency: "weekly" as const,
    priority: 0.6
  }));
  const productEntries = (products ?? []).map((product) => ({
    url: absoluteStorefrontUrl(storefrontSiteUrl, product.seo.canonicalPath),
    lastModified: product.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6
  }));
  return [...staticEntries, ...categoryEntries, ...productEntries];
}
