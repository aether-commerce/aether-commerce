---
"@aether-commerce/api-worker": minor
"@aether-commerce/admin-default": minor
"@aether-commerce/i18n": patch
"@aether-commerce/migrations": minor
"@aether-commerce/storefront-default": patch
---

Save separate USD and COP prices when an operator switches the store currency. Convert new COP amounts at a fixed rate with peso rounding, restore saved USD amounts exactly, and keep shipping and coupon amounts aligned with the selected currency. Keep checkout copy accurate for either configured payment provider.
