---
"@aether-commerce/admin-default": patch
"@aether-commerce/storefront-default": patch
"@aether-commerce/api-worker": patch
"@aether-commerce/i18n": patch
---

Make distributed client surfaces brand-safe and production-safe: private admin
summaries now authenticate and render real configured currency without demo
fallbacks, merchant branding comes from client configuration, and storefront
catalogs no longer expose internal API/demo status labels.
