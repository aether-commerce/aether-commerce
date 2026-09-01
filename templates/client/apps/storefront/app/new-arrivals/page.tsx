import type { Metadata } from "next";
import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../../src/configuration";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("New arrivals", "Recently added products in the storefront catalog.", false, "/new-arrivals");

export default async function NewArrivalsPage() {
  const catalog = await fetchCatalogProducts(clientConfiguration.integrations.api.productionBaseUrl, { page: 1, pageSize: 12, sort: "newest", flag: "new" });
  return <ProductGrid headingLevel="h1" initialProducts={catalog?.products} initialPagination={catalog?.pagination} initialFlag="new" heading="New arrivals" eyebrow="Fresh catalog" description="Recently normalized products and locally promoted arrivals." />;
}
