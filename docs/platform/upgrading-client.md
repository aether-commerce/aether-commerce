# Upgrading a client

Client repositories receive grouped weekly Dependabot pull requests for `@aether-commerce/*` against `develop`. An administrator can also run `.github/workflows/aether-update.yml` from GitHub or the platform settings screen; it updates all workspaces, runs `pnpm aether:migrations`, validates the client and opens a pull request against `develop` only when something changed. After validation, promote `develop` to `main` through the normal production pull request.

Package-owned code updates automatically through this versioned dependency flow. Template-owned files do not: workflows, client configuration, `custom/` components and brand assets remain under the client's control and require an explicit migration when the template evolves. This boundary prevents a platform release from overwriting a client's identity or deployment policy.

For a manual upgrade:

```sh
pnpm update --recursive --latest "@aether-commerce/*"
pnpm aether:migrations
pnpm validate
```

The migration synchronizer only adds missing immutable migrations. It stops if a historical client file differs from the published source. Deployment synchronizes migrations again before applying them to D1, so application code cannot deploy ahead of its schema.

## Product image delivery

Upgrade `@aether-commerce/api-worker`, `@aether-commerce/core` and `@aether-commerce/storefront-default` together. Public catalog endpoints return Cloudinary thumbnails capped at 640 px and detail/gallery images capped at 1600 px, with `c_limit`, `q_auto` and `f_auto`. Persisted and administrative URLs remain originals. No database migration or re-upload is required. Existing custom pages reading `thumbnail` benefit as soon as the upgraded client API is deployed.

Shared product components use `ProductImage` and browser-selected `srcSet` candidates, independently of `images.unoptimized` in the client's Next configuration. Cloudinary receives browser format negotiation directly, without routing these images through the Worker image optimizer. Other providers keep their existing Next image behavior. Signed, authenticated, SVG and animated GIF URLs are preserved.

For a custom composition such as Liminal's atelier, replace its product `<img>` with `ProductImage` imported from `@aether-commerce/storefront-default`. Keep the existing aspect-ratio container and CSS; use `fill` with `sizes` matching the actual grid. Prioritize only an image visible on initial load. Load featured products in the server route with `fetchCatalogProducts` and pass them as initial props; retain a client request only as recovery when that server read fails. The full catalog route can pass `initialProducts` and `initialPagination` to `ProductGrid` the same way.

Custom introduction timing remains client-owned. Shorten its configured duration or reveal content earlier in a separate client change; a package update does not rewrite that animation. After promotion, verify published package versions, the client's lockfile and API deployment, responsive image URLs at mobile/desktop widths, transferred bytes, and browser LCP separately. The previously measured 99.2% image-byte reduction is a sample, not a promised LCP improvement.
