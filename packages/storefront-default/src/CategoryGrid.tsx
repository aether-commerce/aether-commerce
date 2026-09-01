"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Glasses, Headphones, Laptop, Lamp, Smartphone, Sofa, Sparkles, Tablet, Timer, Watch } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStorefrontConfig } from "./AetherStorefrontProvider";
import { useLanguage } from "./LanguageProvider";
import { StorefrontLink } from "./StorefrontLink";

export type StorefrontCategorySectionData = {
  section: { enabled: boolean; eyebrow: string | null; title: string | null; description: string | null };
  categories: Array<{
    id: string;
    slug: string;
    displayName: string;
    description: string | null;
    visual: { type: "icon"; key: string } | { type: "image"; url: string } | { type: "none" };
    productCount: number;
  }>;
};

export type CategorySectionRenderer = (data: StorefrontCategorySectionData) => ReactNode;

/** Stable icon-key resolution for the default skin; other themes can provide a renderer without changing API data. */
const categoryIcons: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  laptop: Laptop,
  headphones: Headphones,
  tablet: Tablet,
  watch: Watch,
  glasses: Glasses,
  sofa: Sofa,
  lamp: Lamp,
  sports: Timer,
  sparkles: Sparkles
};

export function DefaultCategorySectionRenderer({ section, categories }: StorefrontCategorySectionData) {
  const { t } = useLanguage();
  return (
    <section className="py-10">
      <div className="aether-shell">
        {section.eyebrow ? <p className="text-sm font-semibold uppercase text-accent">{section.eyebrow}</p> : null}
        {section.title ? <h2 className="mt-1 text-2xl font-semibold text-zinc-950 md:text-3xl">{section.title}</h2> : null}
        {section.description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{section.description}</p> : null}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((category) => {
            const Icon = category.visual.type === "icon" ? categoryIcons[category.visual.key] ?? Sparkles : null;
            return (
              <StorefrontLink key={category.id} href={`/categories/${category.slug}`} className="group rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-accent hover:shadow-md">
                {category.visual.type === "image" ? <img src={category.visual.url} alt="" className="h-11 w-11 rounded-md object-cover" /> : null}
                {Icon ? <span className="grid h-11 w-11 place-items-center rounded-md bg-accent-soft text-accent"><Icon size={20} aria-hidden /></span> : null}
                <h3 className="mt-4 text-base font-semibold text-zinc-950 group-hover:text-accent">{category.displayName}</h3>
                {category.description ? <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-zinc-600">{category.description}</p> : <div className="min-h-[2.5rem]" />}
                <div className="mt-3 min-h-[1rem]">
                  {category.productCount > 0 ? <p className="text-xs font-medium text-zinc-500">{t.productsCount.replace("{count}", String(category.productCount))}</p> : null}
                </div>
              </StorefrontLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Fetches a theme-neutral DTO. Empty, disabled, or failed data hides the section rather than rendering an empty grid. */
export function CategorySection({ renderer, initialData }: { renderer?: CategorySectionRenderer; initialData?: StorefrontCategorySectionData | null | undefined }) {
  const { apiBaseUrl } = useStorefrontConfig();
  const [data, setData] = useState<StorefrontCategorySectionData | null>(initialData ?? null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiBaseUrl}/api/v1/catalog/category-section`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("category section unavailable");
        return response.json() as Promise<{ success?: boolean; data?: StorefrontCategorySectionData }>;
      })
      .then((payload) => { if (payload.success && payload.data) setData(payload.data); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setData(null); });
    return () => controller.abort();
  }, [apiBaseUrl]);

  if (!data?.section.enabled || data.categories.length === 0) return null;
  return <>{(renderer ?? DefaultCategorySectionRenderer)(data)}</>;
}

/** Backward-compatible default-theme export. New themes should provide a CategorySection renderer. */
export function CategoryGrid({ initialData }: { initialData?: StorefrontCategorySectionData | null | undefined } = {}) {
  return <CategorySection initialData={initialData} />;
}
