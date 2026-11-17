import { CategoryGrid, fetchCatalogCategorySection, resolveStorefrontSeoText, StorefrontLink } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../../src/configuration";
import { configuredPageMetadata, storefrontLocale } from "../seo-config";

const copy = clientConfiguration.seo?.categoryIndex;
const defaults = storefrontLocale === "es"
  ? { title: "Categorías", heading: "Explora por categoría", description: "Encuentra productos por categoría.", catalogLink: "Ver el catálogo completo" }
  : { title: "Categories", heading: "Shop by category", description: "Browse the catalog by category.", catalogLink: "Browse the full catalog" };

export const metadata = configuredPageMetadata(copy, "/categories", defaults);

export default async function CategoriesPage() {
  const section = await fetchCatalogCategorySection(clientConfiguration.integrations.api.productionBaseUrl);
  return (
    <main className="aether-shell py-8">
      <p className="text-sm font-semibold uppercase text-accent">{defaults.title}</p>
      <h1 className="mt-2 text-4xl font-semibold text-zinc-950">
        {resolveStorefrontSeoText(copy?.heading, storefrontLocale, defaults.heading)}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">
        {resolveStorefrontSeoText(copy?.intro, storefrontLocale, defaults.description)}
      </p>
      <StorefrontLink href="/products/" className="focus-ring mt-2 inline-flex min-h-11 items-center underline underline-offset-4">
        {defaults.catalogLink}
      </StorefrontLink>
      <div className="mt-6">
        <CategoryGrid initialData={section} />
      </div>
    </main>
  );
}
