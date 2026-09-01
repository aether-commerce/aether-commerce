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
    return new URL(value?.trim() || fallback);
  } catch {
    return new URL(fallback);
  }
}

export function absoluteStorefrontUrl(siteUrl: string | URL, path: string, basePath = "") {
  const url = new URL(siteUrl.toString());
  const originPath = url.pathname.replace(/\/+$/, "");
  const prefix = basePath ? `/${basePath.replace(/^\/+|\/+$/g, "")}` : "";
  url.pathname = `${originPath}${prefix}${normalizeStorefrontPath(path)}`.replace(/\/\/+/g, "/");
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
  return product.availabilityStatus === "out_of_stock" || product.availabilityStatus === "discontinued"
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
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
