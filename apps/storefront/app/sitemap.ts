import type { MetadataRoute } from "next";
import { absoluteStorefrontUrl, fetchAllCatalogProducts, fetchCatalogCategories } from "@aether-commerce/storefront-default";
import { apiBaseUrl } from "../components/config";
import { demoProducts } from "../components/demo-products";
import { storefrontSiteUrl } from "./seo-config";

const staticPaths: Array<{ path: string; priority: number }> = [
  { path: "/", priority: 1 },
  { path: "/products/", priority: 0.9 },
  { path: "/categories/", priority: 0.7 },
  { path: "/deals/", priority: 0.7 },
  { path: "/featured/", priority: 0.7 },
  { path: "/new-arrivals/", priority: 0.7 },
  { path: "/contact/", priority: 0.3 },
  { path: "/shipping/", priority: 0.3 },
  { path: "/returns/", priority: 0.3 },
  { path: "/terms/", priority: 0.2 },
  { path: "/privacy/", priority: 0.2 },
  { path: "/cookies/", priority: 0.2 }
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [liveProducts, categories] = await Promise.all([fetchAllCatalogProducts(apiBaseUrl), fetchCatalogCategories(apiBaseUrl)]);
  const products = liveProducts ?? demoProducts;

  const staticEntries = staticPaths.map(({ path, priority }) => ({
    url: absoluteStorefrontUrl(storefrontSiteUrl, path),
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority
  })) satisfies MetadataRoute.Sitemap;
  const categoryEntries = (categories ?? []).map((category) => ({
    url: absoluteStorefrontUrl(storefrontSiteUrl, `/categories/${category.slug}`),
    changeFrequency: "weekly" as const,
    priority: 0.6
  }));
  const productEntries = products.map((product) => ({
    url: absoluteStorefrontUrl(storefrontSiteUrl, product.seo.canonicalPath),
    lastModified: product.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
