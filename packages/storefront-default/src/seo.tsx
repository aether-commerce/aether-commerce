import type { Product } from "@aether-commerce/schemas";

export function normalizeStorefrontPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const queryIndex = normalized.search(/[?#]/);
  const pathname = queryIndex === -1 ? normalized : normalized.slice(0, queryIndex);
  const suffix = queryIndex === -1 ? "" : normalized.slice(queryIndex);
  const isFilePath = /\.[^/]+$/.test(pathname);
  const withSlash = pathname.endsWith("/") || isFilePath ? pathname : `${pathname}/`;
  return `${withSlash}${suffix}`;
}

export function resolveStorefrontUrl(value: string | undefined, fallback: string) {
  try {
    const url = new URL(value?.trim() || fallback);
    return url.protocol === "http:" || url.protocol === "https:" ? url : new URL(fallback);
  } catch {
    return new URL(fallback);
  }
}

export function absoluteStorefrontUrl(siteUrl: string | URL, path: string, basePath = "") {
  const url = new URL(siteUrl.toString());
  const originPath = url.pathname.replace(/\/+$/, "");
  const prefix = basePath ? `/${basePath.replace(/^\/+|\/+$/g, "")}` : "";
  const localPath = new URL(normalizeStorefrontPath(path), "https://storefront.invalid");
  url.pathname = `${originPath}${prefix}${localPath.pathname}`.replace(/\/\/+/g, "/");
  url.search = localPath.search;
  url.hash = localPath.hash;
  return url.toString();
}

function absoluteAssetUrl(siteUrl: string | URL, value: string) {
  try {
    return new URL(value, siteUrl.toString()).toString();
  } catch {
    return value;
  }
}

function availabilityForProduct(product: Product) {
  return product.availabilityStatus === "out_of_stock" ||
    product.availabilityStatus === "discontinued"
    ? "https://schema.org/OutOfStock"
    : "https://schema.org/InStock";
}

export function buildProductJsonLd(product: Product, siteUrl: string | URL, basePath = "") {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.shortDescription,
    image: product.images.map((image) => absoluteAssetUrl(siteUrl, image.url)),
    sku: product.sku,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    category: product.category.name,
    url: absoluteStorefrontUrl(siteUrl, product.seo.canonicalPath, basePath),
    offers: {
      "@type": "Offer",
      url: absoluteStorefrontUrl(siteUrl, product.seo.canonicalPath, basePath),
      priceCurrency: product.currency,
      price: (product.finalPrice / 100).toFixed(2),
      availability: availabilityForProduct(product),
      itemCondition: "https://schema.org/NewCondition"
    }
  };
}

export function StorefrontJsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
  siteUrl: string | URL,
  basePath = ""
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteStorefrontUrl(siteUrl, item.path, basePath)
    }))
  };
}

export function isIndexableProduct(product: Product) {
  return product.visible && product.visibility === "visible" && !product.flags.includes("hidden");
}
