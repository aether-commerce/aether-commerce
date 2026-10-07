import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Product } from "@aether-commerce/schemas";
import {
  absoluteStorefrontUrl,
  buildProductJsonLd,
  buildBreadcrumbJsonLd,
  resolveStorefrontUrl,
  StorefrontJsonLd
} from "./seo";

describe("storefront search markup", () => {
  it("keeps canonical paths, query parameters and fragments separate under a base path", () => {
    expect(
      absoluteStorefrontUrl(
        "https://shop.example/?old=1",
        "/products/red-bat?color=red#details",
        "/store"
      )
    ).toBe("https://shop.example/store/products/red-bat/?color=red#details");
    expect(absoluteStorefrontUrl("https://shop.example/", "/sitemap.xml", "/store")).toBe(
      "https://shop.example/store/sitemap.xml"
    );
    expect(resolveStorefrontUrl("javascript:alert(1)", "https://shop.example").origin).toBe(
      "https://shop.example"
    );
  });
  it("emits a real COP offer and absolute breadcrumbs", () => {
    const product = {
      name: "Red Bat",
      description: "Terciopelo rojo",
      images: [{ url: "/red-bat.jpg" }],
      sku: "BAT",
      brand: "Merchant",
      category: { name: "Gargantillas" },
      seo: { canonicalPath: "/products/red-bat" },
      finalPrice: 2500000,
      currency: "COP",
      availabilityStatus: "out_of_stock"
    } as Product;
    const data = buildProductJsonLd(product, "https://shop.example");
    expect(data.offers).toMatchObject({
      price: "25000.00",
      priceCurrency: "COP",
      availability: "https://schema.org/OutOfStock",
      url: "https://shop.example/products/red-bat/"
    });
    expect(data.image).toEqual(["https://shop.example/red-bat.jpg"]);
    expect(
      buildBreadcrumbJsonLd(
        [
          { name: "Inicio", path: "/" },
          { name: "Gargantillas", path: "/categories/gargantillas" }
        ],
        "https://shop.example",
        "/store"
      ).itemListElement[1]
    ).toMatchObject({
      position: 2,
      name: "Gargantillas",
      item: "https://shop.example/store/categories/gargantillas/"
    });
  });
  it("serializes merchant text without allowing it to end the JSON-LD script", () => {
    const data = { description: "</script><script>alert(1)</script>" };
    const html = renderToStaticMarkup(<StorefrontJsonLd data={data} />);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).not.toContain("<script>alert");
    const json = html.slice(html.indexOf(">") + 1, html.lastIndexOf("</script>"));
    expect(JSON.parse(json)).toEqual(data);
  });
});
