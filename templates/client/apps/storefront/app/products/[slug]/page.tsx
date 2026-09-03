import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { absoluteStorefrontUrl, buildProductJsonLd, fetchProductBySlug, ProductDetailClient, StorefrontJsonLd } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../../../src/configuration";
import { storefrontBasePath, storefrontSiteUrl } from "../../seo-config";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_AETHER_API_URL ??
  (process.env.NODE_ENV === "development"
    ? clientConfiguration.integrations.api.localBaseUrl
    : clientConfiguration.integrations.api.productionBaseUrl);

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lookup = await fetchProductBySlug(apiBaseUrl, slug);
  if (lookup.status !== "found") return { robots: { index: false, follow: false } };

  return {
    title: lookup.product.seo.title,
    description: lookup.product.seo.description,
    alternates: { canonical: absoluteStorefrontUrl(storefrontSiteUrl, lookup.product.seo.canonicalPath, storefrontBasePath) },
    openGraph: {
      title: lookup.product.seo.title,
      description: lookup.product.seo.description,
      type: "website",
      url: absoluteStorefrontUrl(storefrontSiteUrl, lookup.product.seo.canonicalPath, storefrontBasePath),
      images: [{ url: lookup.product.images[0]?.url ?? lookup.product.thumbnail, alt: lookup.product.images[0]?.alt ?? lookup.product.name }]
    }
  };
}

export default async function ProductDetailPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const lookup = await fetchProductBySlug(apiBaseUrl, slug);
  if (lookup.status === "not-found") notFound();

  return (
    <>
      {lookup.status === "found" ? <StorefrontJsonLd data={buildProductJsonLd(lookup.product, storefrontSiteUrl, storefrontBasePath)} /> : null}
      <ProductDetailClient
        slug={slug}
        initialProduct={lookup.status === "found" ? lookup.product : null}
        fallbackProduct={null}
      />
    </>
  );
}
