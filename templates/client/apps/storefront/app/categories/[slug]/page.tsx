import type { Metadata } from "next";
import { humanizeCategorySlug } from "@aether-commerce/core";
import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../../../src/configuration";
import { pageMetadata } from "../../seo-config";

// Static export needs generateStaticParams to know which category pages to
// pre-render at build time, and "output: export" refuses to emit zero pages
// for a dynamic segment - a fresh client has no catalog yet, so this ships
// one placeholder slug purely to keep the build valid. Replace with your own
// real category slugs once you have a catalog (see the Aether reference
// repo's apps/storefront/app/categories/[slug]/page.tsx for an example wired
// to a real catalog service).
export function generateStaticParams() {
  return [{ slug: "example" }] as Array<{ slug: string }>;
}

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ slug: string }> }>): Promise<Metadata> {
  const { slug } = await params;
  const categoryName = humanizeCategorySlug(slug);
  return pageMetadata(`${categoryName} products`, `Browse products in the ${categoryName} category.`, false, `/categories/${slug}`);
}

export default async function CategoryProductsPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const categoryName = humanizeCategorySlug(slug);
  const catalog = await fetchCatalogProducts(clientConfiguration.integrations.api.productionBaseUrl, { page: 1, pageSize: 12, sort: "featured", category: slug });

  return (
    <main>
      <ProductGrid headingLevel="h1" fixedCategory={slug} heading={categoryName} description="Products filtered by category." initialProducts={catalog?.products} initialPagination={catalog?.pagination} />
    </main>
  );
}
