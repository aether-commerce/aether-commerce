import { fetchCatalogCategorySection, fetchCatalogProducts, HomePage } from "@aether-commerce/storefront-default";
import { legalPolicyVersion } from "../../../config/legal";
import { clientConfiguration } from "../../../src/configuration";

/**
 * Default home page - keep this file as-is to use the default skin, or
 * replace its contents with your own composition (you can still import and
 * reuse individual pieces like Hero/SiteFooter/CategoryGrid/ProductGrid, or
 * drop them entirely). See README.md for the full override pattern.
 */
export default async function StorefrontHomePage() {
  const apiBaseUrl = clientConfiguration.integrations.api.productionBaseUrl;
  const [hero, categories, deals, topRated, newArrivals] = await Promise.all([
    fetchCatalogProducts(apiBaseUrl, { featured: true, page: 1, pageSize: 4, sort: "featured" }),
    fetchCatalogCategorySection(apiBaseUrl),
    fetchCatalogProducts(apiBaseUrl, { flag: "deal", page: 1, pageSize: 4, sort: "discount" }),
    fetchCatalogProducts(apiBaseUrl, { page: 1, pageSize: 4, sort: "rating" }),
    fetchCatalogProducts(apiBaseUrl, { flag: "new", page: 1, pageSize: 4, sort: "newest" })
  ]);

  return (
    <HomePage
      legalPolicyVersion={legalPolicyVersion}
      initialData={{ heroProducts: hero?.products, categorySection: categories, deals, topRated, newArrivals }}
    />
  );
}
