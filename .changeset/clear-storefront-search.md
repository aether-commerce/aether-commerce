---
"@aether-commerce/storefront-default": minor
---

Add a configurable server-rendered storefront language, category lookup with distinct missing/unavailable states, and a reusable complete sitemap generator. Preserve canonical query strings, safely serialize JSON-LD, and bound catalog requests. Update reference and client-template routes to render real category names and avoid indexing missing catalog entities or truncated sitemaps.

Provide a server-only entry and Cloudflare-compatible early catalog checks: missing detail URLs return HTTP 404, while catalog outages return a retryable HTTP 503 before streaming. Keep transactional pages crawlable so their noindex directives can be read.
