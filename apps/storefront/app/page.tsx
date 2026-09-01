import { fetchCatalogCategorySection, fetchCatalogProducts, HomePage } from "@aether-commerce/storefront-default";
import { apiBaseUrl } from "../components/config";
import { ContactForm } from "../components/ContactForm";
import { legalPolicyVersion } from "../components/legal-content";

// Wraps the package's generic HomePage instead of duplicating its Hero/
// category/product-rail/benefits composition - only the contactForm slot is
// deployment-specific (this deployment's own real ContactForm override).
export default async function Page() {
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
      contactForm={<ContactForm />}
      initialData={{ heroProducts: hero?.products, categorySection: categories, deals, topRated, newArrivals }}
    />
  );
}
