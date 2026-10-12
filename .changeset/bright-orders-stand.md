---
"@aether-commerce/api-core": patch
"@aether-commerce/api-worker": patch
"@aether-commerce/storefront-default": patch
---

Generate deterministic order numbers from the complete checkout identifier so repeated Wompi sandbox payments and manual orders cannot reuse an earlier customer-facing number. Recover safely when the webhook and browser confirm the same payment concurrently, and clarify the checkout recovery message.
