# @aether-commerce/migrations

## 0.4.5

### Patch Changes

- 7dcc055: Trim the trailing blank line from the security hardening migration so downstream client update validation passes.

## 0.4.4

### Patch Changes

- d37664c: Add a store-scoped index for catalog ordering by update time.

## 0.4.3

### Patch Changes

- b8d92e6: Invalidate catalog snapshots across Worker isolates when products or categories change, and keep public catalog responses current.

## 0.4.2

### Patch Changes

- 453a164: Allow Wompi as an order channel in a forward database migration while preserving existing orders.

## 0.4.1

### Patch Changes

- 4379a26: Normalize legacy SQLite product timestamps, repair existing product dates, and distinguish catalog outages from empty search results.

## 0.4.0

### Minor Changes

- dc140a6: Save separate USD and COP prices when an operator switches the store currency. Convert new COP amounts at a fixed rate with peso rounding, restore saved USD amounts exactly, and keep shipping and coupon amounts aligned with the selected currency. Keep checkout copy accurate for either configured payment provider.

## 0.3.0

### Minor Changes

- b0c4057: Reconcile checkout amounts, payment events, refunds and inventory atomically; require production payment configuration and checkout request keys; retry restock notices; extend admin navigation and clarify remaining refund balances. Raise the supported Next.js development version to the patched 16.3.8 release.

## 0.2.7

### Patch Changes

- a2f3fb1: Unify product write validation with the canonical form, add a resumable legacy catalog migration endpoint, and remove obsolete product storage tables from the published schema.

## 0.2.6

### Patch Changes

- a48a0c8: Add configurable storefront category merchandising across the API, admin, schema,
  migration, and default storefront packages, including category visuals, ordering,
  product counts, and related deployment integration.

All notable changes to this package are documented here.
