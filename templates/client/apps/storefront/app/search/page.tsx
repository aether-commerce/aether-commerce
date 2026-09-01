import type { Metadata } from "next";
import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../../src/configuration";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("Search", "Search the storefront catalog.", true, "/search");

export default async function SearchPage() {
  const catalog = await fetchCatalogProducts(clientConfiguration.integrations.api.productionBaseUrl, { page: 1, pageSize: 12, sort: "featured" });
  return <ProductGrid headingLevel="h1" initialProducts={catalog?.products} initialPagination={catalog?.pagination} heading="Search" description="Search, filter, and sort the full catalog." />;
}
