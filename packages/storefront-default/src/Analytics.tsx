"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const analyticsConsentKey = "aether.analyticsConsent.v1";
const analyticsConsentEvent = "aether-analytics-consent";

export type AnalyticsConsent = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(analyticsConsentKey);
  return value === "granted" || value === "denied" ? value : null;
}

export function setAnalyticsConsent(consent: AnalyticsConsent) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(analyticsConsentKey, consent);
  window.dispatchEvent(new Event(analyticsConsentEvent));
}

export function Analytics({ measurementId }: { measurementId?: string | undefined }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null);

  useEffect(() => {
    const syncConsent = () => setConsent(readAnalyticsConsent());
    syncConsent();
    window.addEventListener(analyticsConsentEvent, syncConsent);
    return () => window.removeEventListener(analyticsConsentEvent, syncConsent);
  }, []);

  useEffect(() => {
    if (!measurementId || consent !== "granted" || !window.gtag) return;
    window.gtag("config", measurementId, { page_path: pathname || "/", anonymize_ip: true });
  }, [consent, measurementId, pathname]);

  if (!measurementId || consent !== "granted") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
      <Script id="aether-google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
window.gtag('js', new Date());
window.gtag('config', ${JSON.stringify(measurementId)}, { anonymize_ip: true });`}
      </Script>
    </>
  );
}
