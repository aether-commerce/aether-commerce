// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AetherStorefrontProvider } from "./AetherStorefrontProvider";
import { CartProvider } from "./CartProvider";
import { FavoritesProvider } from "./FavoritesProvider";
import { LanguageProvider } from "./LanguageProvider";
import { ProductGrid } from "./ProductGrid";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const testConfig = {
  brand: { name: "Test Store", primaryColor: "#123456" },
  store: { currency: "USD", locale: "en-US", country: "US" },
  features: { reviews: true, wishlist: true, customerAccounts: true, stripeCheckout: true, aiAssistant: false, inventory: true },
  theme: { primary: "#123456", secondary: "#654321", background: "#ffffff", surface: "#ffffff", text: "#111111", muted: "#666666", border: "#dddddd", radius: "8px", font: "system-ui" },
  checkout: { mode: "stripe", successPath: "/checkout/success", cancelPath: "/cart" },
  integrations: {
    api: { productionBaseUrl: "https://api.example.com", localBaseUrl: "http://localhost:8787", publicUrlEnv: "NEXT_PUBLIC_API_URL" },
    auth: { provider: "clerk", publishableKeyEnv: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" },
    media: { provider: "cloudinary" },
    payments: { provider: "stripe" }
  },
  agent: { enabled: false, publicUrlEnv: "NEXT_PUBLIC_AI_ASSISTANT_URL", defaultLocale: "en" },
  navigation: {}
} as const;

function catalog(locale: "en" | "es", props: ComponentProps<typeof ProductGrid> = {}) {
  return (
    <AetherStorefrontProvider config={testConfig} apiBaseUrl="https://api.example.com">
      <LanguageProvider initialLocale={locale}>
        <CartProvider>
          <FavoritesProvider customerId={null}>
            <ProductGrid {...props} />
          </FavoritesProvider>
        </CartProvider>
      </LanguageProvider>
    </AetherStorefrontProvider>
  );
}

describe("ProductGrid initial HTML", () => {
  it.each([
    ["es", "Catálogo de accesorios", "Encuentra tu próxima pieza."],
    ["en", "Accessories catalog", "Find your next piece."]
  ] as const)("renders the configured %s heading and introduction on the server", (locale, heading, intro) => {
    const html = renderToStaticMarkup(catalog(locale, {
      headingLevel: "h1",
      localizedCopy: {
        heading: { es: "Catálogo de accesorios", en: "Accessories catalog" },
        intro: { es: "Encuentra tu próxima pieza.", en: "Find your next piece." }
      }
    }));
    expect(html).toMatch(new RegExp(`<h1[^>]*>${heading}</h1>`));
    expect(html).toContain(`>${intro}</p>`);
  });
});

describe("ProductGrid catalog failures", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("shows an outage instead of zero results and recovers to the genuine empty state", async () => {
    let productRequests = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/catalog/products?")) {
        productRequests += 1;
        return Promise.resolve(productRequests === 1
          ? new Response("unavailable", { status: 500 })
          : Response.json({ success: true, data: [], pagination: { page: 1, pageSize: 12, total: 0, pageCount: 1 } }));
      }
      return Promise.resolve(Response.json({ success: true, data: [] }));
    }));
    render(catalog("en"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Products are temporarily unavailable");
    expect(screen.queryByText("0 results")).not.toBeInTheDocument();
    expect(screen.queryByText("No products match these filters")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No products match these filters")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText("0 results")).toBeInTheDocument();
  });

  it("localizes the catalog outage for Spanish shoppers", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/catalog/products?")
      ? new Response("unavailable", { status: 500 })
      : Response.json({ success: true, data: [] }))));
    render(catalog("es"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Los productos no están disponibles por ahora");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
