import type { Metadata } from "next";
import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { apiBaseUrl } from "../../components/config";
import { demoProducts } from "../../components/demo-products";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("Search", "Search the Aether catalog.", true, "/search");

export default async function SearchPage() {
  const catalog = await fetchCatalogProducts(apiBaseUrl, { page: 1, pageSize: 12, sort: "featured" });
  return (
    <ProductGrid
      headingLevel="h1"
      heading="Search Aether"
      description="Search, filter, and sort the full Aether catalog through the DummyJSON-backed Catalog Adapter."
      initialProducts={catalog?.products}
      initialPagination={catalog?.pagination}
      fallbackProducts={demoProducts}
    />
  );
}
