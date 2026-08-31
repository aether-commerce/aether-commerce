import type { Metadata } from "next";
import { LegalDocument } from "@aether-commerce/storefront-default";
import { legalDocuments } from "../../../../config/legal";

export const metadata: Metadata = { title: "Shipping | Client Store" };

export default function ShippingPage() {
  return <LegalDocument documentKey="shipping" documents={legalDocuments} />;
}
