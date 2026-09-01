import type { Metadata } from "next";
import "./globals.css";
import { AetherAuthProvider, AetherStorefrontProvider, Analytics, AssistantWidget, CookieNotice, StorefrontJsonLd } from "@aether-commerce/storefront-default";
import { AppProviders } from "../components/AppProviders";
import { LanguageProvider } from "../components/LanguageProvider";
import { FloatingCart } from "../components/FloatingCart";
import { SiteHeader } from "../components/SiteHeader";
import { themeTokensToCssVariables } from "@aether-commerce/ui/theme";
import { aetherClientConfiguration, aetherThemeTokens } from "../../../config/aether";
import { apiBaseUrl, aiAssistantUrl, storefrontBasePath } from "../components/config";
import { legalPolicyVersion } from "../components/legal-content";
import { WhatsappBubble } from "../components/WhatsappBubble";
import { SiteFooter } from "../components/SiteFooter";
import { SentryProvider } from "../components/SentryProvider";
import { analyticsMeasurementId, googleSiteVerification, storefrontMetadataBase, storefrontSiteName, storefrontSiteUrl } from "./seo-config";

export const metadata: Metadata = {
  title: { default: `${storefrontSiteName} | Premium Commerce`, template: `%s | ${storefrontSiteName}` },
  description: "A bilingual premium technology commerce demo powered by a Cloudflare Worker API.",
  metadataBase: storefrontMetadataBase,
  openGraph: {
    title: `${storefrontSiteName} | Premium Commerce`,
    description: "Premium technology shopping demo with a dynamic storefront and Worker API.",
    type: "website",
    url: storefrontMetadataBase
  },
  ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {})
};

const themeInitScript = `
(function () {
  try {
    if (window.localStorage.getItem("aether.theme.v1") === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }

    var storedLocale = window.localStorage.getItem("aether.locale");
    var locale = storedLocale === "en" || storedLocale === "es"
      ? storedLocale
      : (navigator.language || "").toLowerCase().indexOf("es") === 0 ? "es" : "en";
    if (locale !== "en") {
      document.documentElement.setAttribute("data-locale-pending", "1");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <style>{themeTokensToCssVariables(aetherThemeTokens)}</style>
        <style>{`html[data-locale-pending] body { visibility: hidden; }`}</style>
      </head>
      <body>
        <Analytics measurementId={analyticsMeasurementId} />
        <StorefrontJsonLd
          data={[
            { "@context": "https://schema.org", "@type": "WebSite", name: storefrontSiteName, url: storefrontSiteUrl.toString() },
            { "@context": "https://schema.org", "@type": "Organization", name: storefrontSiteName, url: storefrontSiteUrl.toString() }
          ]}
        />
        <SentryProvider>
          <AetherStorefrontProvider
            config={aetherClientConfiguration}
            apiBaseUrl={apiBaseUrl}
            aiAssistantUrl={aiAssistantUrl}
            basePath={storefrontBasePath}
          >
            <AetherAuthProvider>
              <AppProviders>
                <LanguageProvider>
                  <SiteHeader />
                  {children}
                  <SiteFooter />
                  <CookieNotice analyticsEnabled={Boolean(analyticsMeasurementId)} />
                  <AssistantWidget legalPolicyVersion={legalPolicyVersion} />
                  <WhatsappBubble />
                  <FloatingCart />
                </LanguageProvider>
              </AppProviders>
            </AetherAuthProvider>
          </AetherStorefrontProvider>
        </SentryProvider>
      </body>
    </html>
  );
}
