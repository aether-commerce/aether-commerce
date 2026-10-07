import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3010",
    trace: "retain-on-failure"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ],
  webServer: [
    {
      command: "node tests/e2e/catalog-api.mjs",
      url: "http://127.0.0.1:8091/health",
      reuseExistingServer: false
    },
    {
      command: "pnpm dev:storefront:e2e",
      env: { NEXT_PUBLIC_AETHER_API_URL: "http://127.0.0.1:8091" },
      url: "http://localhost:3010",
      reuseExistingServer: false
    }
  ]
});
