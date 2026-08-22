import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ClientConfiguration } from "@aether-commerce/config-schema";
import { AetherAdminProvider } from "./AetherAdminProvider";
import { AdminLanguageProvider } from "./AdminLanguageProvider";

export * from "@testing-library/react";

// Mirrors apps/admin/test/render.tsx with a real client-shaped configuration
// so branding regressions fail in tests instead of being hidden by an unsafe cast.
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

// Every packaged page/component reads its config through useAdminConfig()
// and its copy through useAdminLanguage() - AdminChat's tests need both
// providers in the tree, same as apps/admin/test/render.tsx's render().
// Exported separately (not just used inside render()) so renderHook's
// `wrapper` option can use it directly, e.g. useAdminChatStream.test.ts.
export function AdminTestProviders({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AetherAdminProvider config={testAdminConfig} apiBaseUrl="https://api.test">
      <AdminLanguageProvider>{children}</AdminLanguageProvider>
    </AetherAdminProvider>
  );
}

export function render(ui: ReactElement, options?: RenderOptions): RenderResult {
  return rtlRender(<AdminTestProviders>{ui}</AdminTestProviders>, options);
}
