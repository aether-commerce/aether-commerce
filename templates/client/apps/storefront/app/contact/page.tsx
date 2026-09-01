import type { Metadata } from "next";
import { ContactForm } from "@aether-commerce/storefront-default";
import { legalPolicyVersion } from "../../../../config/legal";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("Contact", "Contact the storefront team.", false, "/contact");

export default function ContactPage() {
  return <ContactForm legalPolicyVersion={legalPolicyVersion} headingLevel="h1" />;
}
