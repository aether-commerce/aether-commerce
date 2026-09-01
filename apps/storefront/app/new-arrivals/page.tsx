import type { Metadata } from "next";
import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { apiBaseUrl } from "../../components/config";
import { demoProducts } from "../../components/demo-products";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("New arrivals", "Recently normalized and promoted additions to the Aether catalog.", false, "/new-arrivals");

export default async function NewArrivalsPage() {
  const catalog = await fetchCatalogProducts(apiBaseUrl, { page: 1, pageSize: 12, sort: "newest", flag: "new" });
  return (
    <ProductGrid
      headingLevel="h1"
      initialFlag="new"
      heading="New arrivals"
      eyebrow="Fresh catalog"
      description="Recently normalized products and locally promoted arrivals."
      initialProducts={catalog?.products}
      initialPagination={catalog?.pagination}
      fallbackProducts={demoProducts}
    />
  );
}
