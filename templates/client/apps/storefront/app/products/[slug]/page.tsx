import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchProductBySlug, ProductDetailClient } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../../../src/configuration";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_AETHER_API_URL ??
  (process.env.NODE_ENV === "development"
    ? clientConfiguration.integrations.api.localBaseUrl
    : clientConfiguration.integrations.api.productionBaseUrl);

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lookup = await fetchProductBySlug(apiBaseUrl, slug);
  if (lookup.status !== "found") return {};

  return {
    title: lookup.product.seo.title,
    description: lookup.product.seo.description,
    alternates: { canonical: lookup.product.seo.canonicalPath },
    openGraph: {
      title: lookup.product.seo.title,
      description: lookup.product.seo.description,
      type: "website",
      url: lookup.product.seo.canonicalPath,
      images: [{ url: lookup.product.images[0]?.url ?? lookup.product.thumbnail, alt: lookup.product.images[0]?.alt ?? lookup.product.name }]
    }
  };
}

export default async function ProductDetailPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const lookup = await fetchProductBySlug(apiBaseUrl, slug);
  if (lookup.status === "not-found") notFound();

  return (
    <ProductDetailClient
      slug={slug}
      initialProduct={lookup.status === "found" ? lookup.product : null}
      fallbackProduct={null}
    />
  );
}
