"use client";
import { Button } from "@aether-commerce/ui";
import { useLanguage } from "./LanguageProvider";
import { StorefrontLink } from "./StorefrontLink";

export function CatalogUnavailablePage() {
  const { locale } = useLanguage();
  return (
    <main className="aether-shell grid min-h-[50vh] place-items-center py-12">
      <section className="max-w-xl rounded-lg border border-zinc-200 bg-white p-8 text-center">
        <h1 className="text-3xl font-semibold text-zinc-950">
          {locale === "es"
            ? "Catálogo temporalmente no disponible"
            : "Catalog temporarily unavailable"}
        </h1>
        <p className="mt-4 text-zinc-600">
          {locale === "es"
            ? "No pudimos cargar los productos. Inténtalo de nuevo en unos momentos."
            : "We couldn't load the products. Please try again in a few moments."}
        </p>
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 cursor-pointer"
        >
          {locale === "es" ? "Intentar de nuevo" : "Try again"}
        </Button>
        <StorefrontLink
          href="/"
          className="focus-ring mt-4 block text-sm font-semibold text-accent hover:underline"
        >
          {locale === "es" ? "Volver al inicio" : "Return home"}
        </StorefrontLink>
      </section>
    </main>
  );
}
