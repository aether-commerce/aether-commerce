import type { Product } from "@aether-commerce/schemas";
import type { Locale } from "./dictionaries";

const spanishCategoryNames: Record<string, string> = {
  laptops: "Portátiles",
  accessories: "Accesorios",
  electronics: "Electrónica",
  furniture: "Muebles",
  shoes: "Calzado",
  miscellaneous: "Misceláneos",
  audio: "Audio",
  clothes: "Ropa",
  clothing: "Ropa",
  technology: "Productos",
  home: "Hogar"
};

export function getLocalizedProduct(product: Product, locale: Locale) {
  const category = spanishCategoryNames[product.category.slug] ?? product.category.name;

  return {
    category: locale === "es" ? category : product.category.name,
    description: product.description
  };
}
