// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AetherStorefrontProvider } from "./AetherStorefrontProvider";
import { CheckoutPage } from "./CheckoutPage";
import { LanguageProvider } from "./LanguageProvider";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const cartClient = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  getCartCredentials: vi.fn(),
  readLocalCart: vi.fn(),
  readLocalCartItems: vi.fn(),
  syncLocalCartToApi: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./customer-client", () => ({
  useCustomerSession: () => ({ customer: { id: "customer-1", name: "Ada Shopper" } })
}));
vi.mock("./AetherAuthProvider", () => ({ useAetherAuth: () => ({ getToken: vi.fn() }) }));
vi.mock("./cart-client", () => ({ createCartClient: () => cartClient }));
vi.mock("./checkout-options", () => ({
  useCheckoutOptions: () => ({ paymentMode: "stripe" }),
  useShippingSettings: () => ({ enabled: true, amountCents: 500 })
}));

const testConfig = {
  brand: { name: "Test Store", primaryColor: "#123456" },
  store: { currency: "USD", locale: "en-US", country: "US" },
  features: {
    reviews: true,
    wishlist: true,
    customerAccounts: true,
    stripeCheckout: true,
    aiAssistant: false,
    inventory: true
  },
  theme: {
    primary: "#123456",
    secondary: "#654321",
    background: "#ffffff",
    surface: "#ffffff",
    text: "#111111",
    muted: "#666666",
    border: "#dddddd",
    radius: "8px",
    font: "system-ui"
  },
  checkout: { mode: "stripe", successPath: "/checkout/success", cancelPath: "/cart" },
  integrations: {
    api: {
      productionBaseUrl: "https://api.example.com",
      localBaseUrl: "http://localhost:8787",
      publicUrlEnv: "NEXT_PUBLIC_API_URL"
    },
    auth: { provider: "clerk", publishableKeyEnv: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" },
    media: { provider: "cloudinary" },
    payments: { provider: "stripe" }
  },
  agent: { enabled: false, publicUrlEnv: "NEXT_PUBLIC_AI_ASSISTANT_URL", defaultLocale: "en" },
  navigation: {}
} as const;

function renderCheckout() {
  return render(
    <AetherStorefrontProvider config={testConfig} apiBaseUrl="https://api.example.com">
      <LanguageProvider initialLocale="en">
        <CheckoutPage />
      </LanguageProvider>
    </AetherStorefrontProvider>
  );
}

describe("CheckoutPage address validation", () => {
  beforeEach(() => {
    router.push.mockClear();
    cartClient.createCheckoutSession.mockReset();
    cartClient.getCartCredentials.mockResolvedValue({ cartId: "cart-1", token: "cart-token" });
    cartClient.readLocalCart.mockReturnValue({ items: [] });
    cartClient.readLocalCartItems.mockReturnValue([]);
    cartClient.syncLocalCartToApi.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(Response.json({
          success: true,
          data: {
            id: "cart-1",
            items: [
              {
                productId: "product-1",
                variantId: "blue",
                quantity: 1,
                name: "Runner",
                slug: "runner",
                imageUrl: "https://example.com/runner.jpg",
                unitPrice: 1000,
                finalUnitPrice: 1000,
                lineTotal: 1000,
                currency: "USD"
              }
            ],
            totals: {
              subtotal: 1000,
              discount: 0,
              shipping: 500,
              tax: 0,
              total: 1500,
              currency: "USD"
            },
            updatedAt: "2026-10-13T00:00:00.000Z"
          }
        }))
      )
    );
  });

  it("shows inline errors, focuses the first missing field, and clears the message when complete", async () => {
    renderCheckout();
    const continueButton = await screen.findByRole("button", { name: "Continue to payment" });
    const form = continueButton.closest("form");
    expect(form).toHaveAttribute("novalidate");

    fireEvent.click(continueButton);

    const error = await screen.findByText("Please fill in all required fields.");
    const fullName = screen.getByLabelText("Full name");
    await waitFor(() => expect(fullName).toHaveFocus());
    expect(fullName).toHaveAttribute("aria-invalid", "true");
    expect(fullName).toHaveAttribute("aria-describedby", "checkout-status");
    expect(error).toHaveAttribute("role", "status");

    fireEvent.change(fullName, { target: { value: "Ada Shopper" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+1 555 0100" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "10 Main Street" } });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "New York" } });
    fireEvent.change(screen.getByLabelText("Department"), { target: { value: "New York" } });

    await waitFor(() =>
      expect(screen.queryByText("Please fill in all required fields.")).not.toBeInTheDocument()
    );
    expect(fullName).toHaveAttribute("aria-invalid", "false");
  });
});
