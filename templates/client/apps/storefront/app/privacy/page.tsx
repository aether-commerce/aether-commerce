import type { Metadata } from "next";
import { LegalDocument } from "@aether-commerce/storefront-default";
import { legalDocuments } from "../../../../config/legal";

export const metadata: Metadata = { title: "Privacy | Client Store" };

export default function PrivacyPage() {
  return <LegalDocument documentKey="privacy" documents={legalDocuments} />;
}
