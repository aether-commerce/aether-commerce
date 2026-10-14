// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AetherStorefrontProvider, useStorefrontConfig } from "./AetherStorefrontProvider";
import { DefaultCategorySectionRenderer } from "./CategoryGrid";
import { LanguageProvider } from "./LanguageProvider";

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

function RuntimeCurrencyProbe() {
  const { config } = useStorefrontConfig();
  return <span>{config.store.currency}</span>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DefaultCategorySectionRenderer", () => {
  it("renders configured categories in API order with canonical category URLs and computed counts", () => {
    render(
      <AetherStorefrontProvider config={testConfig} apiBaseUrl="https://api.example.com">
        <LanguageProvider>
          <DefaultCategorySectionRenderer
            section={{ enabled: true, eyebrow: "CATEGORIES", title: "Shop by category", description: "Curated for this storefront." }}
            categories={[
              { id: "cat_audio", slug: "audio", displayName: "Audio", description: "Headphones and speakers.", visual: { type: "icon", key: "headphones" }, productCount: 12 },
              { id: "cat_phone", slug: "smartphones", displayName: "Phones", description: null, visual: { type: "none" }, productCount: 4 }
            ]}
          />
        </LanguageProvider>
      </AetherStorefrontProvider>
    );

    expect(screen.getByRole("heading", { name: "Shop by category" })).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/categories/audio", "/categories/smartphones"]);
    expect(screen.getByText("12 products")).toBeInTheDocument();
    expect(screen.getByText("4 products")).toBeInTheDocument();
  });
});

describe("AetherStorefrontProvider runtime currency", () => {
  it("uses the API store currency instead of a stale build-time currency", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
      if (url.endsWith("/api/v1/runtime-config")) {
        return Promise.resolve(Response.json({ success: true, data: { currency: "COP" } }));
      }
      return Promise.resolve(Response.json({ success: true, data: { features: { reviews: true } } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AetherStorefrontProvider config={testConfig} apiBaseUrl="https://api.example.com">
        <RuntimeCurrencyProbe />
      </AetherStorefrontProvider>
    );

    await waitFor(() => expect(screen.getByText("COP")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/runtime-config",
      { headers: { accept: "application/json" } }
    );
  });
});
