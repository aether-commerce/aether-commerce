"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { dictionaries, type Locale } from "./dictionaries";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (typeof dictionaries)[Locale];
};
const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectLocale(initialLocale?: Locale): Locale {
  try {
    const stored = window.localStorage.getItem("aether.locale");
    if (stored === "en" || stored === "es") return stored;
  } catch {
    // Browsing and language changes remain available when storage is blocked.
  }
  if (initialLocale) return initialLocale;
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

export function LanguageProvider({
  children,
  initialLocale
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  // The first client render must match SSR. A configured storefront language
  // wins over browser detection; an explicit saved selection still wins later.
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? "en");

  useLayoutEffect(() => {
    setLocaleState(detectLocale(initialLocale));
    document.documentElement.removeAttribute("data-locale-pending");
  }, [initialLocale]);

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale(nextLocale) {
        try {
          window.localStorage.setItem("aether.locale", nextLocale);
        } catch {
          // Keep the selection for this visit even if it cannot be persisted.
        }
        document.documentElement.lang = nextLocale;
        setLocaleState(nextLocale);
      },
      t: dictionaries[locale]
    }),
    [locale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
