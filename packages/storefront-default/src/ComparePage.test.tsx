// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Product } from "@aether-commerce/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AetherStorefrontProvider } from "./AetherStorefrontProvider";
import { ComparePage } from "./ComparePage";
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

const testProduct = {
  id: "product-1",
  slug: "test-product",
  name: "Test product",
  availableStock: 5,
  availabilityStatus: "in_stock",
  inventory: { status: "in_stock" },
  images: [{ url: "https://example.com/product.jpg", alt: "Test product", source: "local" }],
  thumbnail: "https://example.com/product.jpg",
  category: { slug: "audio", name: "Audio" },
  finalPrice: 1000,
  currency: "USD",
  rating: { average: 4.5, count: 2 },
  specifications: [],
  sku: "TEST-1"
} as unknown as Product;

function renderComparison(reviewsEnabled: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { features: { reviews: reviewsEnabled } } })
    })
  );
  window.localStorage.setItem("aether.compareItems.v1", JSON.stringify([testProduct]));

  return render(
    <AetherStorefrontProvider config={testConfig} apiBaseUrl="https://api.example.com">
      <LanguageProvider initialLocale="en">
        <ComparePage />
      </LanguageProvider>
    </AetherStorefrontProvider>
  );
}

describe("ComparePage review ratings", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("hides the rating row when reviews are disabled in the admin settings", async () => {
    renderComparison(false);

    await waitFor(() => expect(screen.queryByRole("columnheader", { name: "Rating" })).not.toBeInTheDocument());
    expect(screen.queryByText("4.5")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Price" })).toBeInTheDocument();
  });

  it("shows the rating row when reviews are enabled", async () => {
    renderComparison(true);

    expect(await screen.findByRole("columnheader", { name: "Rating" })).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });
});
