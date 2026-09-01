import type { Metadata } from "next";
import { CategoryGrid, fetchCatalogCategorySection } from "@aether-commerce/storefront-default";
import { apiBaseUrl } from "../../components/config";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("Categories", "Browse the Aether catalog by category.", false, "/categories");

export default async function CategoriesPage() {
  const section = await fetchCatalogCategorySection(apiBaseUrl);
  return (
    <main className="aether-shell py-8">
      <p className="text-sm font-semibold uppercase text-accent">Categories</p>
      <h1 className="mt-2 text-4xl font-semibold text-zinc-950">Shop by category</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">Explore the live Aether catalog across curated technology and lifestyle categories.</p>
      <div className="mt-6">
        <CategoryGrid initialData={section} />
      </div>
    </main>
  );
}
