import type { Metadata } from "next";
import { LegalDocument } from "@aether-commerce/storefront-default";
import { legalDocuments } from "../../../../config/legal";

export const metadata: Metadata = { title: "Cookies | Client Store" };

export default function CookiesPage() {
  return <LegalDocument documentKey="cookies" documents={legalDocuments} />;
}
