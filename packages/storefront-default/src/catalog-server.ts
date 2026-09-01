import type { Product, ProductQuery } from "@aether-commerce/schemas";
import type { StorefrontCategorySectionData } from "./CategoryGrid";

export type CatalogPagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export type CatalogProductsResult = { products: Product[]; pagination: CatalogPagination };

export type CatalogCategory = { slug: string; name: string };
export type CatalogQuery = Partial<Omit<ProductQuery, "page" | "pageSize">> & { page?: number; pageSize?: number };

type CatalogProductsPayload = {
  success?: boolean;
  data?: Product[];
  pagination?: CatalogPagination;
};

const cachedCatalogRequest = {
  next: { revalidate: 300 },
  headers: { accept: "application/json" }
} as RequestInit;

function apiUrl(apiBaseUrl: string, path: string) {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/catalog/${path}`;
}

function queryString(query: CatalogQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export async function fetchCatalogProducts(apiBaseUrl: string, query: CatalogQuery = {}): Promise<CatalogProductsResult | null> {
  if (!apiBaseUrl) return null;
  try {
    const suffix = queryString(query);
    const response = await fetch(`${apiUrl(apiBaseUrl, "products")}${suffix ? `?${suffix}` : ""}`, cachedCatalogRequest);
    if (!response.ok) return null;
    const payload = (await response.json()) as CatalogProductsPayload;
    if (!payload.success || !payload.data) return null;
    return {
      products: payload.data,
      pagination: payload.pagination ?? {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? payload.data.length,
        total: payload.data.length,
        pageCount: 1
      }
    };
  } catch {
    return null;
  }
}

export async function fetchAllCatalogProducts(apiBaseUrl: string) {
  const firstPage = await fetchCatalogProducts(apiBaseUrl, { page: 1, pageSize: 60, sort: "featured" });
  if (!firstPage) return null;
  const products = [...firstPage.products];
  for (let page = 2; page <= firstPage.pagination.pageCount; page += 1) {
    const nextPage = await fetchCatalogProducts(apiBaseUrl, { page, pageSize: 60, sort: "featured" });
    if (!nextPage) return products;
    products.push(...nextPage.products);
  }
  return products;
}

export async function fetchCatalogCategories(apiBaseUrl: string) {
  if (!apiBaseUrl) return null;
  try {
    const response = await fetch(apiUrl(apiBaseUrl, "categories"), cachedCatalogRequest);
    if (!response.ok) return null;
    const payload = (await response.json()) as { success?: boolean; data?: Array<CatalogCategory | string> };
    if (!payload.success || !payload.data) return null;
    return payload.data.map((entry) => (typeof entry === "string" ? { slug: entry, name: entry } : entry));
  } catch {
    return null;
  }
}

export async function fetchCatalogCategorySection(apiBaseUrl: string) {
  if (!apiBaseUrl) return null;
  try {
    const response = await fetch(apiUrl(apiBaseUrl, "category-section"), cachedCatalogRequest);
    if (!response.ok) return null;
    const payload = (await response.json()) as { success?: boolean; data?: StorefrontCategorySectionData };
    return payload.success && payload.data ? payload.data : null;
  } catch {
    return null;
  }
}
