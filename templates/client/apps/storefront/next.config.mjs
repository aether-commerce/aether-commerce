import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const basePath = process.env.NEXT_PUBLIC_AETHER_BASE_PATH?.replace(/\/$/, "") || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  images: {
    unoptimized: true
  },
  // Client storefronts use unoptimized images; do not trace optional native
  // image binaries into the Workers bundle.
  outputFileTracingExcludes: {
    "*": ["node_modules/@img/sharp-wasm32/**/*", "node_modules/@emnapi/**/*"]
  },
  trailingSlash: true,
  turbopack: {
    root: workspaceRoot
  }
};

export default nextConfig;
