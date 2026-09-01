import type { Metadata } from "next";
import { absoluteStorefrontUrl, resolveStorefrontUrl } from "@aether-commerce/storefront-default";
import { aetherClientConfiguration } from "../../../config/aether";
import { storefrontBasePath } from "../components/config";

export const storefrontSiteUrl = resolveStorefrontUrl(process.env.NEXT_PUBLIC_AETHER_STOREFRONT_URL, "https://store.diferez.com");
export const storefrontMetadataBase = new URL(absoluteStorefrontUrl(storefrontSiteUrl, "/", storefrontBasePath));
export const storefrontSiteName = aetherClientConfiguration.brand.name;
export const analyticsMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
export const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export function pageMetadata(title: string, description: string, noIndex = false, path = "/"): Metadata {
  return {
    title,
    description,
    alternates: { canonical: absoluteStorefrontUrl(storefrontSiteUrl, path, storefrontBasePath) },
    ...(noIndex ? { robots: { index: false, follow: false } } : {})
  };
}
