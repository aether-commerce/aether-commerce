import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const basePath = process.env.NEXT_PUBLIC_AETHER_BASE_PATH?.replace(/\/$/, "") || "";
const e2eClerkStub = process.env.AETHER_E2E_STUB_CLERK === "true";
const configuredStorefrontPattern = (() => {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_AETHER_STOREFRONT_URL || "");
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return { protocol: url.protocol.slice(0, -1), hostname: url.hostname, ...(url.port ? { port: url.port } : {}) };
  } catch {
    return null;
  }
})();

// These apply to server-rendered HTML as well as static assets. Cloudflare's
// public/_headers alone does not cover responses produced by OpenNext.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://*.protect.clerk.com https://challenges.cloudflare.com https://clerk.diferez.com https://accounts.diferez.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com https://res.cloudinary.com https://img.clerk.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.pickofwow.workers.dev https://*.clerk.accounts.dev https://*.clerk.com https://*.protect.clerk.com:* https://clerk.diferez.com https://accounts.diferez.com https://*.sentry.io https://*.ingest.sentry.io https://www.google-analytics.com https://region1.google-analytics.com",
  "frame-src https://*.clerk.accounts.dev https://*.clerk.com https://*.protect.clerk.com https://challenges.cloudflare.com https://clerk.diferez.com https://accounts.diferez.com https://checkout.stripe.com",
  "worker-src 'self' blob:",
  "form-action 'self' https://checkout.stripe.com",
  "upgrade-insecure-requests"
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com")' }
      ]
    }];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1440, 1920],
    imageSizes: [32, 44, 64, 96, 128, 256, 384],
    minimumCacheTTL: 3600,
    remotePatterns: [
      { protocol: "https", hostname: "store.diferez.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "http", hostname: "localhost" },
      ...(configuredStorefrontPattern ? [configuredStorefrontPattern] : [])
    ]
  },
  // Keep the optional native image stack out of the Worker bundle; the
  // storefront image optimizer uses the app's sharp dependency at build time.
  outputFileTracingExcludes: {
    "*": ["node_modules/@img/sharp-wasm32/**/*", "node_modules/@emnapi/**/*"]
  },
  trailingSlash: true,
  turbopack: {
    root: workspaceRoot
  },
  webpack(config) {
    if (e2eClerkStub) {
      config.resolve.alias["@clerk/react"] = resolve(dirname(fileURLToPath(import.meta.url)), "e2e/clerk.tsx");
    }
    return config;
  }
};

export default nextConfig;
