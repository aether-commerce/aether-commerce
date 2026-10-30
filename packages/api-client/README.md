# @aether-commerce/api-client

Creates a client for the Aether commerce API. Supply the API origin as `baseUrl` and optionally provide `getToken` for authenticated requests.

```ts
import { createCommerceClient } from "@aether-commerce/api-client";

const client = createCommerceClient({ baseUrl: "https://api.example.com" });
const products = await client.products({ page: 1, pageSize: 5, sort: "featured" });
```

For cart operations, keep the cart token supplied by the API and provide it to the corresponding client method. Use the API origin for the same environment as the storefront.
