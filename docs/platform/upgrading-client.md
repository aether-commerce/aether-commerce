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
