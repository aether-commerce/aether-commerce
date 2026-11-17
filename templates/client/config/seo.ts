import { storefrontSeoConfigSchema } from "@aether-commerce/config-schema";

// Add localized copy here. Use the public category slug for category overrides.
export const seoConfig = storefrontSeoConfigSchema.parse({
  home: {
    heading: { es: "Explora nuestra tienda", en: "Explore our store" },
    intro: { es: "Descubre los productos del catálogo.", en: "Discover the products in our catalog." }
  }
});
