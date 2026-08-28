import { z } from "zod";

const safeText = (max: number) => z.string().trim().min(1).max(max).refine((value) => !/[<>]/.test(value), "HTML is not allowed.");

/** Stable visual identifiers. Themes resolve these keys; the database never stores UI imports or markup. */
export const categoryVisualTypeSchema = z.enum(["icon", "image", "none"]);
export const categoryIconKeySchema = z.enum([
  "smartphone",
  "laptop",
  "headphones",
  "tablet",
  "watch",
  "glasses",
  "sofa",
  "lamp",
  "sports",
  "sparkles"
]);

export const categorySectionUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  eyebrow: safeText(80).nullable().optional(),
  title: safeText(120).nullable().optional(),
  description: safeText(500).nullable().optional()
}).strict();

const categoryMerchandisingFields = {
  enabled: z.boolean().optional(),
  displayName: safeText(120).nullable().optional(),
  description: safeText(500).nullable().optional(),
  visualType: categoryVisualTypeSchema.optional(),
  iconKey: categoryIconKeySchema.nullable().optional(),
  imageUrl: z.string().url().max(2048).refine((value) => new URL(value).protocol === "https:", "imageUrl must use HTTPS").nullable().optional()
};

function validateVisual(value: { visualType?: "icon" | "image" | "none" | undefined; iconKey?: string | null | undefined; imageUrl?: string | null | undefined }, context: z.RefinementCtx) {
    if (value.visualType === "icon" && value.iconKey === null) {
      context.addIssue({ code: "custom", path: ["iconKey"], message: "An icon visual requires an icon key." });
    }
    if (value.visualType === "image" && value.imageUrl === null) {
      context.addIssue({ code: "custom", path: ["imageUrl"], message: "An image visual requires an HTTPS image URL." });
    }
}

export const categoryMerchandisingWriteSchema = z.object(categoryMerchandisingFields).strict().superRefine(validateVisual);

export const categoryMerchandisingAddSchema = z.object({ categoryId: z.string().trim().min(1).max(120), ...categoryMerchandisingFields }).strict().superRefine(validateVisual);
export const categoryMerchandisingReorderSchema = z.object({ categoryIds: z.array(z.string().trim().min(1).max(120)).min(1).max(500) });

export type CategorySectionUpdate = z.infer<typeof categorySectionUpdateSchema>;
export type CategoryMerchandisingWrite = z.infer<typeof categoryMerchandisingWriteSchema>;
