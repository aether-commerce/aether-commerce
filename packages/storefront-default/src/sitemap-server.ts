import type { MetadataRoute } from "next";
import { fetchAllCatalogProducts, fetchCatalogCategories } from "./catalog-server";
import { absoluteStorefrontUrl, isIndexableProduct } from "./seo";

export type StorefrontSitemapOptions = {
  apiBaseUrl: string;
  siteUrl: string | URL;
  basePath?: string;
  /** Only routes actually implemented by the client belong here. */
  staticPaths?: string[];
};

/** Do not cache a truncated sitemap during a temporary catalog failure. */
export async function buildStorefrontSitemap({
  apiBaseUrl,
  siteUrl,
  basePath = "",
  staticPaths = ["/", "/products", "/categories", "/contact"]
}: StorefrontSitemapOptions): Promise<MetadataRoute.Sitemap> {
  const [catalog, categories] = await Promise.all([
    fetchAllCatalogProducts(apiBaseUrl),
    fetchCatalogCategories(apiBaseUrl)
  ]);
  if (!catalog || !categories)
    throw new Error("Catalog unavailable while generating the storefront sitemap.");
  const products = catalog.filter(isIndexableProduct);
  const activeCategories = new Set(products.map((product) => product.category.slug));
  const entries: MetadataRoute.Sitemap = [
    ...staticPaths.map((path) => ({ url: absoluteStorefrontUrl(siteUrl, path, basePath) })),
    ...categories
      .filter((category) => activeCategories.has(category.slug))
      .map((category) => ({
        url: absoluteStorefrontUrl(
          siteUrl,
          "/categories/" + encodeURIComponent(category.slug),
          basePath
        )
      })),
    ...products.map((product) => ({
      url: absoluteStorefrontUrl(siteUrl, product.seo.canonicalPath, basePath),
      ...(product.updatedAt ? { lastModified: product.updatedAt } : {})
    }))
  ];
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}
