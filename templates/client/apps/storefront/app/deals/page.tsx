import type { Metadata } from "next";
import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../../src/configuration";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("Deals", "Discounted products with backend-calculated final prices.", false, "/deals");

export default async function DealsPage() {
  const catalog = await fetchCatalogProducts(clientConfiguration.integrations.api.productionBaseUrl, { page: 1, pageSize: 12, sort: "discount", flag: "deal" });
  return <ProductGrid headingLevel="h1" initialProducts={catalog?.products} initialPagination={catalog?.pagination} initialFlag="deal" heading="Deals" eyebrow="Discounts" description="Discounted products with backend-calculated final prices." />;
}
