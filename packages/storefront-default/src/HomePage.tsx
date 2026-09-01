"use client";

import type { ReactNode } from "react";
import type { Product } from "@aether-commerce/schemas";
import { ArrowRight } from "lucide-react";
import { Benefits } from "./Benefits";
import { CategorySection } from "./CategoryGrid";
import { ContactForm } from "./ContactForm";
import { Hero } from "./Hero";
import { ProductGrid } from "./ProductGrid";
import { useLanguage } from "./LanguageProvider";
import { StorefrontLink } from "./StorefrontLink";
import type { CatalogPagination } from "./catalog-server";
import type { StorefrontCategorySectionData } from "./CategoryGrid";

export type HomePageInitialData = {
  heroProducts?: Product[] | undefined;
  categorySection?: StorefrontCategorySectionData | null | undefined;
  deals?: { products: Product[]; pagination: CatalogPagination } | null | undefined;
  topRated?: { products: Product[]; pagination: CatalogPagination } | null | undefined;
  newArrivals?: { products: Product[]; pagination: CatalogPagination } | null | undefined;
};

// The composition (Hero, categories, product rails, benefits, final CTA) is
// the single source of truth - a fresh client keeping the default skin and
// the Aether reference deployment (apps/storefront/app/page.tsx, which wraps
// this component instead of duplicating the composition) both use it as-is.
// contactForm is the one slot the reference deployment overrides, passing
// its own real ContactForm (apps/storefront/components/ContactForm.tsx)
// instead of this package's address-less generic one.
export function HomePage({ legalPolicyVersion, contactForm, initialData }: Readonly<{ legalPolicyVersion: string; contactForm?: ReactNode; initialData?: HomePageInitialData }>) {
  const { t } = useLanguage();

  return (
    <main>
      <Hero initialProducts={initialData?.heroProducts} />

      <CategorySection initialData={initialData?.categorySection} />

      <ProductGrid
        compact
        pageSize={4}
        initialFlag="deal"
        initialSort="discount"
        heading={t.dealsHeading}
        description={t.dealsDescription}
        initialProducts={initialData?.deals?.products}
        initialPagination={initialData?.deals?.pagination}
      />
      <ProductGrid
        compact
        pageSize={4}
        initialSort="rating"
        heading={t.topRatedHeading}
        description={t.topRatedDescription}
        initialProducts={initialData?.topRated?.products}
        initialPagination={initialData?.topRated?.pagination}
      />
      <ProductGrid
        compact
        pageSize={4}
        initialFlag="new"
        initialSort="newest"
        heading={t.lastChanceHeading}
        description={t.lastChanceDescription}
        initialProducts={initialData?.newArrivals?.products}
        initialPagination={initialData?.newArrivals?.pagination}
      />

      <Benefits />

      <section className="py-12">
        <div className="aether-shell rounded-lg border border-zinc-200 bg-white p-8 text-center sm:p-12">
          <h2 className="text-2xl font-semibold text-zinc-950 sm:text-3xl">{t.finalCtaTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-600">{t.finalCtaDescription}</p>
          <StorefrontLink
            href="/products"
            className="focus-ring mt-6 inline-flex min-h-12 items-center gap-2 rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            {t.finalCtaButton}
            <ArrowRight size={16} aria-hidden />
          </StorefrontLink>
        </div>
      </section>

      {contactForm ?? <ContactForm legalPolicyVersion={legalPolicyVersion} />}
    </main>
  );
}
