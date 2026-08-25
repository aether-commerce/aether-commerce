import type { ReactElement } from "react";
import { render as rtlRender, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ClientConfiguration } from "@aether-commerce/config-schema";
import { AdminLanguageProvider, AetherAdminProvider } from "@aether-commerce/admin-default";

export * from "@testing-library/react";

const testAdminConfig = {
  brand: { name: "Test Store", primaryColor: "#111111", tagline: { en: "Test", es: "Prueba" } },
  store: { currency: "USD", locale: "en-US", country: "US" },
  features: {
    reviews: true,
    wishlist: true,
    customerAccounts: true,
    stripeCheckout: true,
    aiAssistant: true,
    inventory: true
  },
  theme: {
    primary: "#111111",
    secondary: "#444444",
    background: "#ffffff",
    surface: "#ffffff",
    text: "#111111",
    muted: "#666666",
    border: "#dddddd",
    radius: "0.5rem",
    font: "system-ui"
  },
  checkout: { mode: "stripe", successPath: "/checkout/success", cancelPath: "/cart" },
  integrations: {
    api: {
      productionBaseUrl: "https://api.test",
      localBaseUrl: "http://localhost:8787",
      publicUrlEnv: "NEXT_PUBLIC_API_BASE_URL"
    },
    auth: { provider: "clerk", publishableKeyEnv: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" },
    media: { provider: "cloudinary" },
    payments: { provider: "stripe" }
  },
  agent: { enabled: true, publicUrlEnv: "NEXT_PUBLIC_AI_ASSISTANT_URL", defaultLocale: "en" },
  navigation: {}
} satisfies ClientConfiguration;

// Every admin page/component now reads its copy through useAdminLanguage(),
// so tests need the provider in the tree - wrapping it here once means test
// files keep using plain render(<Page />) instead of repeating the wrapper
// at every call site. Locale always resolves to "en" in jsdom (no
// localStorage entry, default navigator.language), matching the English
// strings the tests assert against.
export function render(ui: ReactElement, options?: RenderOptions): RenderResult {
  return rtlRender(
    <AetherAdminProvider config={testAdminConfig} apiBaseUrl="https://api.test">
      <AdminLanguageProvider>{ui}</AdminLanguageProvider>
    </AetherAdminProvider>,
    options
  );
}
