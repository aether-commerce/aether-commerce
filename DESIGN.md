---
version: 1
name: "Aether Commerce default surfaces"
description: "A brand-neutral commerce shell whose identity is supplied by each client configuration."
colors:
  primary: "#8B5CF6"
  secondary: "#0E7490"
  background: "#F7F7FB"
  surface: "#FFFFFF"
  text: "#16171D"
  muted: "#5B5F6B"
  success: "#047857"
  warning: "#B45309"
  danger: "#E11D48"
typography:
  sans:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  DEFAULT: "0.5rem"
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
spacing:
  section-gap: "2.5rem"
  page-max: "77.5rem"
components:
  button: {}
  card: {}
  dialog: {}
  table: {}
  input: {}
---

# Aether Commerce design system

## Overview

The creative north star is a calm, well-organized retail counter: products and operational facts are prominent, while platform machinery stays out of sight. Storefront shoppers and store operators are the audiences. English and Spanish are active UI locales; client copy and identity come from `ClientConfiguration` or the runtime brand endpoint.

This is a hybrid register: storefront routes may carry the client's expressive brand, while admin routes prioritize familiar, dense operational UI. The memorable signature is the client-selected accent color used consistently across both surfaces. Avoid template/demo language, technical connection labels, fake commerce data, and hardcoded Aether branding in distributable UI.

Token ownership follows the existing-runtime-canonical model. The live sources are [storefront globals](apps/storefront/app/globals.css) and [admin globals](apps/admin/app/globals.css); this document mirrors their intent. Client theme values enter through `config/theme.ts`, `config/brand.ts`, providers, and the brand API. Aether remains an internal package namespace, never a fallback merchant identity.

## Colors and typography

Light surfaces use the documented neutral background, white cards, restrained borders, dark text and violet/teal accents. Dark theme overrides live in the two global stylesheets. Semantic success, warning and danger colors communicate state and must not be replaced by the brand accent. Focus uses a visible three-pixel secondary-accent outline.

Inter is the preferred Latin UI family with system fallbacks. Numbers use tabular figures where comparison matters. Headings use sentence case; uppercase is reserved for short eyebrow/status labels that convey customer-facing meaning.

## Layout, depth and shapes

The storefront shell is capped at 1180px; the admin shell at 1240px. Admin navigation uses the canonical 264px/72px sidebar and 64px header variables. Responsive drawers and bottom sheets replace desktop side panels. Async placeholders must preserve final geometry to avoid layout shift.

Resting cards are flat with borders. Shadows are reserved for floating menus, drawers, dialogs and transient feedback. Controls and cards use restrained medium radii; pills are reserved for badges and compact filters.

## Components and states

Shared controls come from `@aether-commerce/ui`; shared client-facing screens come from `admin-default` and `storefront-default`. Every async surface owns loading, empty, error and ready states. Loading metrics use stable skeletons; failed private reads show retryable errors and never demo values. Buttons preserve width while busy, disable duplicate submission, and expose focus-visible styling. Forms use inline app-owned validation with `noValidate`; dialogs/sheets replace native alert, confirm and prompt APIs.

Lucide is the canonical icon family. Icons that are the only control label require an accessible name. Motion is brief state feedback, respects reduced-motion preferences, and must not delay core actions.

Money always uses the configured store currency and locale. Operational labels such as API connectivity, sandbox internals or package names are not shopper-facing content. Explicit public demo routes may show a demo banner and seeded metrics; private client routes may not.

## Do's and don'ts

- Do resolve merchant name, logo, tagline, colors, currency and locale from client/runtime configuration.
- Do keep package-owned components canonical so compatible fixes ship through versioned releases.
- Don't use “Aether” as visible fallback branding inside distributable components.
- Don't substitute demo fixtures when private production data is unavailable; render loading or recovery UI.
