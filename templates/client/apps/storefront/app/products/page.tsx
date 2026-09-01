import type { Metadata } from "next";
import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../../src/configuration";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("Products", `Shop the full ${clientConfiguration.brand.name} catalog.`, false, "/products");

export default async function ProductsPage() {
  const catalog = await fetchCatalogProducts(clientConfiguration.integrations.api.productionBaseUrl, { page: 1, pageSize: 12, sort: "featured" });
  return (
    <main>
      <ProductGrid headingLevel="h1" initialProducts={catalog?.products} initialPagination={catalog?.pagination} />
    </main>
  );
}
