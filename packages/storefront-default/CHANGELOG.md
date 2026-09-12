# @aether-commerce/storefront-default

## 0.3.5

### Patch Changes

- 06d5f0c: Correct Spanish authentication localization, cart availability feedback, accessible storefront controls, and review-source messaging.

## 0.3.4

### Patch Changes

- 3be1cd1: Remove legacy catalog seed and static-image fallback paths so storefront catalog data comes exclusively from the live product API.

## 0.3.3

### Patch Changes

- a2f3fb1: Unify product write validation with the canonical form, add a resumable legacy catalog migration endpoint, and remove obsolete product storage tables from the published schema.
- Updated dependencies [a2f3fb1]
  - @aether-commerce/schemas@0.3.0
  - @aether-commerce/api-client@0.2.2
  - @aether-commerce/core@0.2.3
  - @aether-commerce/ui@0.2.4

## 0.3.2

### Patch Changes

- 0f6cc95: Update Next.js, Hono, sharp, Browserslist, and Wrangler to security-patched dependency versions.

## 0.3.1

### Patch Changes

- Updated dependencies [e122600]
  - @aether-commerce/ui@0.2.3

## 0.3.0

### Minor Changes

- a76853c: Add server-rendered catalog data, reusable storefront SEO helpers, product structured data, responsive image optimization, consent-gated analytics, and category/catalog fetch utilities for client storefronts.

## 0.2.5

### Patch Changes

- 2651398: Ship a reusable legal-document renderer and complete legal route shells in the client template. Legal copy and contact details remain client-owned.

## 0.2.4

### Patch Changes

- 5244e2e: Add request-time product loading support for storefronts so products created in the admin do not require a frontend rebuild.

## 0.2.3

### Patch Changes

- Updated dependencies [105a819]
  - @aether-commerce/core@0.2.2
  - @aether-commerce/ui@0.2.2

## 0.2.2

### Patch Changes

- a48a0c8: Add configurable storefront category merchandising across the API, admin, schema,
  migration, and default storefront packages, including category visuals, ordering,
  product counts, and related deployment integration.
- Updated dependencies [a48a0c8]
  - @aether-commerce/schemas@0.2.1
  - @aether-commerce/api-client@0.2.1
  - @aether-commerce/core@0.2.1
  - @aether-commerce/ui@0.2.1
