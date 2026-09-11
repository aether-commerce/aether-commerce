import type { Metadata } from "next";
import { humanizeCategorySlug } from "@aether-commerce/core";
import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { apiBaseUrl } from "../../../components/config";
import { pageMetadata } from "../../seo-config";

export function generateStaticParams() {
  return [
    "smartphones",
    "laptops",
    "mobile-accessories",
    "tablets",
    "mens-watches",
    "womens-watches",
    "sunglasses",
    "furniture",
    "home-decoration",
    "sports-accessories"
  ].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const categoryName = humanizeCategorySlug(slug);
  return pageMetadata(`${categoryName} products`, `Browse Aether products in the ${categoryName} category.`, false, `/categories/${slug}`);
}

export default async function CategoryProductsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categoryName = humanizeCategorySlug(slug);
  const catalog = await fetchCatalogProducts(apiBaseUrl, { page: 1, pageSize: 12, sort: "featured", category: slug });

  return (
    <main>
      <ProductGrid
      fixedCategory={slug}
      headingLevel="h1"
        heading={categoryName}
      description="Products filtered by category through the Aether Catalog Adapter."
      initialProducts={catalog?.products}
      initialPagination={catalog?.pagination}
      />
    </main>
  );
}
