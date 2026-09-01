import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { absoluteStorefrontUrl, buildProductJsonLd, fetchProductBySlug, ProductDetailClient, StorefrontJsonLd } from "@aether-commerce/storefront-default";
import { demoProducts } from "../../../components/demo-products";

import { apiBaseUrl, storefrontBasePath } from "../../../components/config";
import { storefrontSiteUrl } from "../../seo-config";

export const dynamic = "force-dynamic";

async function productForRequest(slug: string) {
  const lookup = await fetchProductBySlug(apiBaseUrl, slug);
  if (lookup.status === "found") return lookup.product;
  return demoProducts.find((candidate) => candidate.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await productForRequest(slug);
  if (!product) return { robots: { index: false, follow: false } };

  return {
    title: product.seo.title,
    description: product.seo.description,
    alternates: { canonical: absoluteStorefrontUrl(storefrontSiteUrl, product.seo.canonicalPath, storefrontBasePath) },
    openGraph: {
      title: product.seo.title,
      description: product.seo.description,
      type: "website",
      url: absoluteStorefrontUrl(storefrontSiteUrl, product.seo.canonicalPath, storefrontBasePath),
      images: [{ url: product.images[0]?.url ?? product.thumbnail, alt: product.images[0]?.alt ?? product.name }]
    }
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lookup = await fetchProductBySlug(apiBaseUrl, slug);
  const fallbackProduct = demoProducts.find((candidate) => candidate.slug === slug) ?? null;
  if (lookup.status === "not-found" && !fallbackProduct) notFound();
  const product = lookup.status === "found" ? lookup.product : fallbackProduct;

  return (
    <>
      {product ? <StorefrontJsonLd data={buildProductJsonLd(product, storefrontSiteUrl, storefrontBasePath)} /> : null}
      <ProductDetailClient
        slug={slug}
        initialProduct={lookup.status === "found" ? lookup.product : null}
        fallbackProduct={fallbackProduct}
      />
    </>
  );
}
