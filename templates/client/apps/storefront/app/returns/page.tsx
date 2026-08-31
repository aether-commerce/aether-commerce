import type { Metadata } from "next";
import { LegalDocument } from "@aether-commerce/storefront-default";
import { legalDocuments } from "../../../../config/legal";

export const metadata: Metadata = { title: "Returns | Client Store" };

export default function ReturnsPage() {
  return <LegalDocument documentKey="returns" documents={legalDocuments} />;
}
