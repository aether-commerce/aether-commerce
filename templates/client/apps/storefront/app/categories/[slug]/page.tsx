import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchCatalogCategoryBySlug,
  fetchCatalogProducts,
  ProductGrid
} from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../../../src/configuration";
import { storefrontLocale } from "../../seo-config";
const apiBaseUrl =
  process.env.NEXT_PUBLIC_AETHER_API_URL ??
  (process.env.NODE_ENV === "development"
    ? clientConfiguration.integrations.api.localBaseUrl
    : clientConfiguration.integrations.api.productionBaseUrl);
import { pageMetadata } from "../../seo-config";

export const dynamic = "force-dynamic";

async function categoryForSlug(slug: string) {
  const lookup = await fetchCatalogCategoryBySlug(apiBaseUrl, slug);
  if (lookup.status === "not-found") notFound();
  if (lookup.status === "unavailable") throw new Error("Catalog unavailable.");
  return lookup.category;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await categoryForSlug(slug);
  const description =
    storefrontLocale === "es"
      ? "Explora nuestra selección de " + category.name + "."
      : "Browse our " + category.name + " collection.";
  return pageMetadata(category.name, description, false, "/categories/" + encodeURIComponent(slug));
}

export default async function CategoryProductsPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await categoryForSlug(slug);
  const catalog = await fetchCatalogProducts(apiBaseUrl, {
    page: 1,
    pageSize: 12,
    sort: "featured",
    category: slug
  });
  if (!catalog) throw new Error("Catalog unavailable.");
  return (
    <main>
      <ProductGrid
        fixedCategory={slug}
        headingLevel="h1"
        heading={category.name}
        initialProducts={catalog.products}
        initialPagination={catalog.pagination}
      />
    </main>
  );
}
