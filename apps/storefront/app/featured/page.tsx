import type { Metadata } from "next";
import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { apiBaseUrl } from "../../components/config";
import { demoProducts } from "../../components/demo-products";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("Featured products", "Products promoted through Aether catalog rules.", false, "/featured");

export default async function FeaturedPage() {
  const catalog = await fetchCatalogProducts(apiBaseUrl, { page: 1, pageSize: 12, sort: "featured", flag: "featured" });
  return (
    <ProductGrid
      headingLevel="h1"
      initialFlag="featured"
      heading="Featured products"
      eyebrow="Featured"
      description="Products promoted through Aether overrides and catalog rules."
      initialProducts={catalog?.products}
      initialPagination={catalog?.pagination}
      fallbackProducts={demoProducts}
    />
  );
}
