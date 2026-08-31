import type { Metadata } from "next";
import { LegalDocument } from "@aether-commerce/storefront-default";
import { legalDocuments } from "../../../../config/legal";

export const metadata: Metadata = { title: "Terms | Client Store" };

export default function TermsPage() {
  return <LegalDocument documentKey="terms" documents={legalDocuments} />;
}
