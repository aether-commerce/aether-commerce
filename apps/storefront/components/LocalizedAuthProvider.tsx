"use client";

import { AetherAuthProvider } from "@aether-commerce/storefront-default";
import { useLanguage } from "./LanguageProvider";

export function LocalizedAuthProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLanguage();
  return <AetherAuthProvider locale={locale}>{children}</AetherAuthProvider>;
}
