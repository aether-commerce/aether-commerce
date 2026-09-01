import type { Metadata } from "next";
import { ContactForm } from "../../components/ContactForm";
import { pageMetadata } from "../seo-config";

export const metadata: Metadata = pageMetadata("Contact", "Contact the Aether storefront team.", false, "/contact");

export default function ContactPage() {
  return <ContactForm headingLevel="h1" />;
}
