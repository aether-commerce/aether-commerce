import { describe, expect, it } from "vitest";
import { categoryMerchandisingWriteSchema, categorySectionUpdateSchema } from "./storefront-merchandising";

describe("storefront category merchandising schemas", () => {
  it("accepts stable visual references and safe editorial content", () => {
    expect(categoryMerchandisingWriteSchema.safeParse({ displayName: "Todo para tu celular", visualType: "icon", iconKey: "smartphone" }).success).toBe(true);
    expect(categoryMerchandisingWriteSchema.safeParse({ visualType: "image", imageUrl: "https://images.example/category.jpg" }).success).toBe(true);
  });

  it("rejects executable presentation input and unsafe image URLs", () => {
    expect(categoryMerchandisingWriteSchema.safeParse({ className: "bg-violet-500" }).success).toBe(false);
    expect(categorySectionUpdateSchema.safeParse({ title: "<img src=x onerror=alert(1)>" }).success).toBe(false);
    expect(categoryMerchandisingWriteSchema.safeParse({ visualType: "image", imageUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});
