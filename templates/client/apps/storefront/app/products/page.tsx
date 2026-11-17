import { fetchCatalogProducts, ProductGrid } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../../src/configuration";
import { configuredPageMetadata, storefrontLocale, storefrontSiteName } from "../seo-config";

const copy = clientConfiguration.seo?.catalog;
export const metadata = configuredPageMetadata(
  copy,
  "/products",
  storefrontLocale === "es"
    ? { title: "Catálogo", description: `Explora el catálogo de ${storefrontSiteName}.` }
    : { title: "Catalog", description: `Shop the full ${storefrontSiteName} catalog.` }
);

export default async function ProductsPage() {
  const catalog = await fetchCatalogProducts(clientConfiguration.integrations.api.productionBaseUrl, { page: 1, pageSize: 12, sort: "featured" });
  return (
    <main>
      <ProductGrid headingLevel="h1" localizedCopy={copy} initialProducts={catalog?.products} initialPagination={catalog?.pagination} />
    </main>
  );
}
