import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const basePath = process.env.NEXT_PUBLIC_AETHER_BASE_PATH?.replace(/\/$/, "") || "";
const e2eClerkStub = process.env.AETHER_E2E_STUB_CLERK === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "store.diferez.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http", hostname: "localhost" }
    ]
  },
  // The storefront deliberately uses unoptimized images. Excluding the
  // optional native image stack keeps the Workers bundle portable and avoids
  // tracing platform-specific binaries that are not needed at runtime.
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
