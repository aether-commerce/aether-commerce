import type { Metadata } from "next";
import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { apiBaseUrl } from "../../components/config";
import { demoProducts } from "../../components/demo-products";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("Products", "Shop the full Aether technology catalog.", false, "/products");

export default async function ProductsPage() {
  const catalog = await fetchCatalogProducts(apiBaseUrl, { page: 1, pageSize: 12, sort: "featured" });
  return (
    <main>
      <ProductGrid headingLevel="h1" initialProducts={catalog?.products} initialPagination={catalog?.pagination} fallbackProducts={demoProducts} />
    </main>
  );
}
