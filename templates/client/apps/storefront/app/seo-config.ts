import type { Metadata } from "next";
import { absoluteStorefrontUrl, resolveStorefrontUrl } from "@aether-commerce/storefront-default";
import { clientConfiguration } from "../../../src/configuration";

export const storefrontBasePath = (process.env.NEXT_PUBLIC_AETHER_BASE_PATH || "").replace(/\/$/, "");
export const storefrontSiteUrl = resolveStorefrontUrl(process.env.NEXT_PUBLIC_AETHER_STOREFRONT_URL, "http://localhost:3000");
export const storefrontMetadataBase = new URL(absoluteStorefrontUrl(storefrontSiteUrl, "/", storefrontBasePath));
export const storefrontSiteName = clientConfiguration.brand.name;
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
