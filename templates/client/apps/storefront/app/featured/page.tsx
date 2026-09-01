import type { Metadata } from "next";
import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../../src/configuration";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("Featured products", "Products promoted through storefront catalog rules.", false, "/featured");

export default async function FeaturedPage() {
  const catalog = await fetchCatalogProducts(clientConfiguration.integrations.api.productionBaseUrl, { page: 1, pageSize: 12, sort: "featured", flag: "featured" });
  return <ProductGrid headingLevel="h1" initialProducts={catalog?.products} initialPagination={catalog?.pagination} initialFlag="featured" heading="Featured products" eyebrow="Featured" description="Products promoted through catalog overrides and rules." />;
}
