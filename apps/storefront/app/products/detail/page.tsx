import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { storefrontPath } from "../../../components/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LegacyProductDetailRedirectPage({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const { slug } = await searchParams;
  permanentRedirect(storefrontPath(slug ? `/products/${encodeURIComponent(slug)}` : "/products"));
}
