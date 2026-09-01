"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { setAnalyticsConsent, type AnalyticsConsent } from "./Analytics";
import { useStorefrontConfig } from "./AetherStorefrontProvider";
import { useLanguage } from "./LanguageProvider";
import { StorefrontLink } from "./StorefrontLink";

const noticeStorageKey = "aether.cookieNotice.v1";

export function CookieNotice({ analyticsEnabled = false }: { analyticsEnabled?: boolean | undefined } = {}) {
  const { locale } = useLanguage();
  const { config } = useStorefrontConfig();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = window.localStorage.getItem("aether.analyticsConsent.v1");
    setVisible(
      window.localStorage.getItem(noticeStorageKey) !== "dismissed" ||
        (analyticsEnabled && consent !== "granted" && consent !== "denied")
    );
  }, [analyticsEnabled]);

  if (!visible) return null;

  const chooseAnalytics = (consent: AnalyticsConsent) => {
    if (analyticsEnabled) setAnalyticsConsent(consent);
    window.localStorage.setItem(noticeStorageKey, "dismissed");
    setVisible(false);
  };

  return (
    <aside
      className="fixed left-1/2 top-20 z-40 w-[min(680px,calc(100vw-24px))] -translate-x-1/2 rounded-lg border border-border-strong bg-surface p-4 shadow-2xl"
      aria-label={locale === "es" ? "Aviso de cookies" : "Cookie notice"}
    >
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-sm leading-6 text-ink-muted">
          {locale === "es"
            ? analyticsEnabled
              ? `${config.brand.name} usa almacenamiento funcional y, si lo autorizas, analítica de uso opcional para mejorar la tienda.`
              : `${config.brand.name} usa almacenamiento funcional para la sesión, el carrito, el idioma y el tema. No usa publicidad ni analítica.`
            : analyticsEnabled
              ? `${config.brand.name} uses functional storage and, if you allow it, optional usage analytics to improve the store.`
              : `${config.brand.name} uses functional storage for the session, cart, language, and theme. It uses no advertising or analytics.`}{" "}
          <StorefrontLink
            className="focus-ring font-semibold text-ink underline decoration-accent underline-offset-4"
            href="/cookies"
          >
            {locale === "es" ? "Ver detalle" : "View details"}
          </StorefrontLink>
        </p>
        <button
          type="button"
          onClick={() => chooseAnalytics("denied")}
          className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-surface-hover hover:text-ink"
          aria-label={locale === "es" ? "Cerrar aviso" : "Dismiss notice"}
        >
          <X size={17} aria-hidden />
        </button>
      </div>
      {analyticsEnabled ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => chooseAnalytics("denied")}
            className="focus-ring rounded-md border border-border-strong px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            {locale === "es" ? "Solo necesario" : "Necessary only"}
          </button>
          <button
            type="button"
            onClick={() => chooseAnalytics("granted")}
            className="focus-ring rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-strong"
          >
            {locale === "es" ? "Aceptar analítica" : "Allow analytics"}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
