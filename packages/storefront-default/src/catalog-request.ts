import { fetchCatalogCategoryBySlug } from "./catalog-server";
import { fetchProductBySlug } from "./product-detail-server";

/** Run before a streamed response starts so missing entities keep a real 404. */
export async function catalogRequestStatus(
  apiBaseUrl: string,
  pathname: string,
  basePath = ""
): Promise<200 | 404 | 503> {
  const prefix = basePath.replace(/\/$/, "");
  const path =
    prefix && pathname.startsWith(prefix + "/") ? pathname.slice(prefix.length) : pathname;
  const match = /^\/(products|categories)\/([^/]+)\/?$/.exec(path);
  if (!match) return 200;
  let slug: string;
  try {
    slug = decodeURIComponent(match[2]!);
  } catch {
    return 404;
  }
  const lookup =
    match[1] === "products"
      ? await fetchProductBySlug(apiBaseUrl, slug)
      : await fetchCatalogCategoryBySlug(apiBaseUrl, slug);
  return lookup.status === "found" ? 200 : lookup.status === "not-found" ? 404 : 503;
}
