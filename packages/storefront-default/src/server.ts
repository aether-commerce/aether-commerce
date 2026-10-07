// Server-only entry keeps middleware free of client providers and auth SDKs.
export { catalogRequestStatus } from "./catalog-request";
export { fetchProductBySlug, type ProductLookup } from "./product-detail-server";
export {
  fetchCatalogCategoryBySlug,
  fetchCatalogCategories,
  fetchCatalogProducts,
  fetchAllCatalogProducts,
  type CategoryLookup
} from "./catalog-server";
export { buildStorefrontSitemap, type StorefrontSitemapOptions } from "./sitemap-server";
