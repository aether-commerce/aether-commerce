# Category ownership

Packages may define `package_categories` as an optional starting taxonomy. A store is provisioned with a copy of those rows in `store_categories`; the copy is the store's operational source of truth and has no runtime dependency on the package.

Products use `products.store_category_id` and `products.store_id`. The API validates both values, and the database trigger rejects a category owned by another store. `products.category` remains a synchronized slug for rolling compatibility with older clients and is not used as the ownership relationship.

The active store is selected with the optional `STORE_ID` Worker binding and defaults to `store_default` for existing deployments. `createStoreFromPackage` copies package rows transactionally through a D1 batch. When no package is supplied, it creates a store with only the system `sin-categoria` row so product creation remains valid.

Categories with products cannot be deleted unless the caller supplies a different category in `reassignToId`; system categories cannot be deleted. Existing catalog rows are migrated to `store_default`, preserving their slugs and assigning unknown values to `sin-categoria`.
