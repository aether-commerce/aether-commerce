# UX Contract

## Product context

- Audience: shoppers and authenticated store operators.
- Primary jobs: discover and purchase products; manage catalog, inventory, orders and customers.
- Active locales: English and Spanish, with client runtime locale/currency as formatting authority.
- Accessibility target: WCAG 2.2 AA.

## Business-context sources

| Domain / scope             | Authoritative source                             | Source type        | Reviewed date |
| -------------------------- | ------------------------------------------------ | ------------------ | ------------- |
| Permission model           | `packages/core/src/rbac.ts` and admin middleware | Code policy        | 2026-08-22    |
| Data/API lifecycle         | `docs/platform/client-architecture.md`           | Architecture       | 2026-08-22    |
| Database migrations        | `docs/platform/upgrading-client.md`              | Upgrade contract   | 2026-08-22    |
| Payments and launch limits | `docs/legal-audit.md` and ADR 0012               | Legal review / ADR | 2026-08-22    |
| Client ownership           | `docs/platform/creating-a-client.md`             | Architecture       | 2026-08-22    |

## Visual contract

- Project design context: `DESIGN.md`.
- Token model: existing runtime canonical.
- Runtime sources: `apps/storefront/app/globals.css`, `apps/admin/app/globals.css`, client `config/theme.ts` and brand providers.
- Supported themes: light and dark.
- Canonical owners: `packages/ui`, `packages/storefront-default`, and `packages/admin-default`; client apps remain thin adapters.

## Canonical UI map

| Capability              | Canonical owner                                  | Allowed variants                   | Verification                        |
| ----------------------- | ------------------------------------------------ | ---------------------------------- | ----------------------------------- |
| Form controls           | `@aether-commerce/ui` plus packaged form screens | create / edit                      | component tests + client validation |
| Dialog / drawer / sheet | `@aether-commerce/ui`                            | dialog / side sheet / bottom sheet | keyboard + focus review             |
| Tables and lists        | `admin-default` shared pages                     | paginated / compact                | component + integration tests       |
| Toast/status feedback   | app-owned packaged components                    | success / warning / error          | live-region test                    |
| CRUD flows              | packaged admin pages + API Worker routes         | pessimistic mutation               | integration tests                   |

## Behavioral contract

- Search is debounced and URL-backed where shareable; IME composition must not submit early.
- Loading, empty, no-results and error are distinct states. A failed private read never renders demo fixtures.
- Mutations are pessimistic, prevent duplicate submission and preserve entered values on recoverable failure.
- Store operators curate the storefront hero from the product form: only products marked as featured are eligible, and an optional position from 1 to 4 controls the exact hero slot. Unpositioned featured products fill remaining slots by rating.
- Native `alert`, `confirm` and `prompt` are prohibited; use the canonical dialog/sheet and inline validation.
- Permission-denied data is hidden or replaced by an explicit 403/recovery message; secrets never appear in clipboard feedback or logs.
- Desktop sidebars become mobile drawers. Floating layers restore focus and must not be obscured by sticky navigation.
- Merchant identity and financial formatting always resolve from runtime/client configuration. Aether is an internal platform namespace.

## Distribution contract

- Versioned package code, schemas and immutable migrations reach clients through an update PR to `develop`, then promotion to `main`.
- `config/`, `custom/`, workflows and assets are client-owned and are never overwritten by a package release.
- Public demo data is allowed only on explicit demo routes. Client production routes show real values, stable loading UI or retryable errors.

## Verification

- Required static checks: package typechecks, lint, contract tests, changeset validation and generated-client validation.
- Required UI matrix for changed surfaces: storefront/admin, desktop/mobile, English/Spanish, light/dark, loading/success/error.
- Failure-path evidence: authenticated summary tests must prove demo values and notices never appear on private routes.
