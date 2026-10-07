# Storefront SEO ownership

The storefront-default package owns reusable catalog reads, canonical URL construction, safe Product/Offer JSON-LD, breadcrumbs and sitemap generation. Each merchant owns its domain, language, titles, descriptions, category aliases, editorial content and verified delivery information.

Pass initialLocale="es" to LanguageProvider to render Spanish in the server response and first client render. Without this prop, the previous English-first/browser-detection behavior remains compatible. A saved visitor choice overrides the configured language after hydration. Storage failures must not prevent browsing or language selection. Do not hide the document while detecting language.

Load categories with fetchCatalogCategoryBySlug; use the returned entity name rather than deriving a title from its slug. A missing entity maps to notFound(), and unavailable catalog data remains a retryable server error. Apply the same distinction to product routes. Check status before parsing an API error body.

Use buildStorefrontSitemap with the actual implemented staticPaths and the configured basePath. It excludes hidden products and categories without visible products, deduplicates URLs, and fails rather than publishing a truncated list after an API outage. JSON-LD and sitemap prices/availability come from the real catalog; currency amounts use the platform's existing minor-unit contract.

Configure noindex on transactional/internal-search pages while allowing crawlers to see that directive. Choose one HTTPS hostname at the merchant's hosting layer and redirect alternate hosts/protocols there. Platform releases never inject a merchant's city, product keywords, fabricated reviews, delivery promises or legal policies.

Verify initial HTML content, canonical targets, missing-resource HTTP status, sitemap XML and schema in the deployed application. Next.js can send a 200 shell before a late notFound(); the emitted noindex is necessary but does not replace checking the actual response. Cache Components/streaming configurations may require an existence check before streaming.

## Status before streaming on Cloudflare

The client and reference middleware check entity existence before Next starts streaming. Missing entities rewrite to the existing not-found UI with HTTP 404 and noindex; catalog outages rewrite to a retryable unavailable UI with HTTP 503, noindex and Retry-After. Static assets and catalog list pages bypass this check. Middleware imports the dedicated storefront-default/server entry to keep client/auth SDKs out of the guard. Each detail navigation performs an additional catalog read for this early existence check.

The middleware.ts convention is deliberately retained because the current OpenNext Cloudflare adapter does not support Node middleware/proxy. Reassess when the adapter supports Next proxy. Reference: https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/.
