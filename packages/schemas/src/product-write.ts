import { z } from "zod";

export const productImageWriteSchema = z.object({
  main: z.string().trim().min(1),
  gallery: z.array(z.string().trim().min(1)).default([])
});

/** Canonical payload accepted by the product form and catalog importer. */
export const productWriteSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(80).optional(),
  sku: z.string().trim().min(1).max(40).optional(),
  brand: z.string().trim().max(80).nullable().optional(),
  category: z.string().trim().min(1).max(60),
  subcategory: z.string().trim().max(60).nullable().optional(),
  shortDescription: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(5000),
  highlights: z.array(z.string().trim().min(1)).max(10).optional(),
  specs: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string().trim().min(1)).max(20).optional(),
  variants: z
    .array(z.object({ type: z.string().trim().min(1), options: z.array(z.string().trim().min(1)).min(1) }))
    .optional(),
  images: productImageWriteSchema,
  seoTitle: z.string().trim().max(160).optional(),
  seoDescription: z.string().trim().max(300).optional(),
  priceCents: z.number().int().min(0),
  compareAtPriceCents: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).optional(),
  visibility: z.enum(["draft", "visible", "hidden"]).optional(),
  featured: z.boolean().optional(),
  featuredPosition: z.number().int().min(1).max(4).nullable().optional(),
  isNew: z.boolean().optional(),
  isDeal: z.boolean().optional()
});

export const productWriteSchemaValidated = productWriteSchema.refine(
  (value) => value.compareAtPriceCents == null || value.compareAtPriceCents > value.priceCents,
  { message: "compareAtPriceCents must be greater than priceCents", path: ["compareAtPriceCents"] }
);

export const productPatchSchema = productWriteSchema.partial().refine(
  (value) => value.compareAtPriceCents == null || value.priceCents == null || value.compareAtPriceCents > value.priceCents,
  { message: "compareAtPriceCents must be greater than priceCents", path: ["compareAtPriceCents"] }
);

export type ProductWriteInput = z.infer<typeof productWriteSchema>;
export type ProductPatchInput = z.infer<typeof productPatchSchema>;

/** Applies the same trimming/default rules to imports and live form writes. */
export function normalizeProductWriteInput(input: ProductWriteInput): ProductWriteInput {
  return {
    ...input,
    name: input.name.trim(),
    slug: input.slug?.trim() || undefined,
    sku: input.sku?.trim() || undefined,
    brand: input.brand?.trim() || null,
    category: input.category.trim(),
    subcategory: input.subcategory?.trim() || null,
    shortDescription: input.shortDescription.trim(),
    description: input.description.trim(),
    highlights: input.highlights?.map((value) => value.trim()).filter(Boolean),
    specs: input.specs
      ? Object.entries(input.specs).reduce<Record<string, string>>((result, [key, value]) => {
          const normalizedKey = key.trim();
          const normalizedValue = value.trim();
          if (normalizedKey && normalizedValue) result[normalizedKey] = normalizedValue;
          return result;
        }, {})
      : undefined,
    tags: input.tags?.map((value) => value.trim()).filter(Boolean),
    variants: input.variants?.map((variant) => ({
      type: variant.type.trim(),
      options: variant.options.map((option) => option.trim()).filter(Boolean)
    })),
    images: {
      main: input.images.main.trim(),
      gallery: input.images.gallery.map((value) => value.trim()).filter(Boolean)
    },
    seoTitle: input.seoTitle?.trim() || undefined,
    seoDescription: input.seoDescription?.trim() || undefined
  };
}
