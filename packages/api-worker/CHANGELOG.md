# @aether-commerce/api-worker

## 0.6.1

### Patch Changes

- 5798cf5: Use Wompi's signed Web Checkout with a recoverable checkout snapshot reference, route sandbox events to the correct store environment, and show operator readiness for the required keys and COP currency.

## 0.6.0

### Minor Changes

- b0c4057: Reconcile checkout amounts, payment events, refunds and inventory atomically; require production payment configuration and checkout request keys; retry restock notices; extend admin navigation and clarify remaining refund balances. Raise the supported Next.js development version to the patched 16.3.8 release.

### Patch Changes

- Updated dependencies [b0c4057]
  - @aether-commerce/api-core@0.2.5

## 0.5.1

### Patch Changes

- 8ad69d8: Deliver bounded Cloudinary product images with automatic quality and format in public catalog responses while preserving administrative originals. Add a responsive ProductImage component that works when client applications disable the Next.js optimizer, and use it throughout shared product surfaces.
- Updated dependencies [8ad69d8]
  - @aether-commerce/core@0.3.0
  - @aether-commerce/api-core@0.2.4

## 0.5.0

### Minor Changes

- a2f3fb1: Unify product write validation with the canonical form, add a resumable legacy catalog migration endpoint, and remove obsolete product storage tables from the published schema.

### Patch Changes

- 3a71dbb: Trim whitespace from Cloudinary credentials before signing uploads so CI-provisioned secrets remain usable.
- Updated dependencies [a2f3fb1]
  - @aether-commerce/schemas@0.3.0
  - @aether-commerce/api-core@0.2.3
  - @aether-commerce/core@0.2.3

## 0.4.2

### Patch Changes

- 0f6cc95: Update Next.js, Hono, sharp, Browserslist, and Wrangler to security-patched dependency versions.

## 0.4.1

### Patch Changes

- e5081f0: Keep category and brand visible in product creation while retaining secondary fields behind advanced options.

## 0.4.0

### Minor Changes

- dda9e0f: Simplify product creation with progressive advanced options and server-side Gemini suggestions for editable catalog and SEO details.

## 0.3.10

### Patch Changes

- ec78d69: Keep the administration assistant aligned with the dedicated categories module and route category-management questions to it.

## 0.3.9

### Patch Changes

- Updated dependencies [105a819]
  - @aether-commerce/core@0.2.2
  - @aether-commerce/api-core@0.2.2

## 0.3.8

### Patch Changes

- 6ea006b: Use the live store currency in product pricing fields, order totals, and admin assistant money values.

## 0.3.7

### Patch Changes

- a48a0c8: Add configurable storefront category merchandising across the API, admin, schema,
  migration, and default storefront packages, including category visuals, ordering,
  product counts, and related deployment integration.
- Updated dependencies [a48a0c8]
  - @aether-commerce/schemas@0.2.1
  - @aether-commerce/api-core@0.2.1
  - @aether-commerce/core@0.2.1

All notable changes to this package are documented here.
