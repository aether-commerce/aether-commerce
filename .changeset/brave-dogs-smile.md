---
"@aether-commerce/storefront-default": patch
---

Disable automatic route prefetching in storefront links and cache product details so catalog routes can be generated at build time. This reduces unnecessary Worker renders on the Free plan while keeping new catalog routes available through revalidation.
