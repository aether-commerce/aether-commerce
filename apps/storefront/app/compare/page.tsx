import type { Metadata } from "next";

export const metadata: Metadata = { title: "Compare", robots: { index: false, follow: false } };

import { ComparePage } from "@aether-commerce/storefront-default";

export default function CompareRoute() {
  return <ComparePage />;
}
