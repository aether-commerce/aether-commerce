import type { Metadata } from "next";
import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { apiBaseUrl } from "../../components/config";
import { demoProducts } from "../../components/demo-products";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("Deals", "Discounted products with backend-calculated final prices.", false, "/deals");

export default async function DealsPage() {
  const catalog = await fetchCatalogProducts(apiBaseUrl, { page: 1, pageSize: 12, sort: "discount", flag: "deal" });
  return (
    <ProductGrid
      headingLevel="h1"
      initialFlag="deal"
      heading="Aether deals"
      eyebrow="Discounts"
      description="Discounted products with backend-calculated final prices."
      initialProducts={catalog?.products}
      initialPagination={catalog?.pagination}
      fallbackProducts={demoProducts}
    />
  );
}
