# Versioning

Use `pnpm changeset` for every consumer-visible package change: patch for compatible fixes, minor for compatible features and major for breaks. CI rejects a pull request that changes a public package without a new changeset. `pnpm version:packages` applies approved versions.

Publishing is automated by `publish-packages.yml` after a merge to `main`. The workflow detects a pending changeset or pre-versioned package manifest, validates the workspace and generated client, versions packages with Changesets when needed, publishes to GitHub Packages and pushes release tags. `workflow_dispatch` with `dry_run=true` remains available for a packaging rehearsal.

The workflow can notify a client repository through `repository_dispatch` after publishing. Configure the `AETHER_CLIENT_DISPATCH_TOKEN` repository secret with a GitHub App or fine-grained token that has repository Contents: read/write access to the client, and set the `AETHER_CLIENT_REPOSITORY` repository variable when the default `aether-commerce/liminal-store` is not the target. If the secret is absent, Dependabot remains the fallback and the package release is not blocked.

The `@aether-commerce` GitHub organization (or whichever account owns that namespace) must grant this repository package-write permission; repository code cannot create that external ownership.
