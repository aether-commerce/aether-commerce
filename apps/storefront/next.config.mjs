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

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
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
