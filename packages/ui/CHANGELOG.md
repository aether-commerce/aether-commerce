# @aether-commerce/ui

## 0.2.3

### Patch Changes

- e122600: Fix the shared `Sheet` panel (used by the admin chat, mobile nav, activity detail, and storefront filter/notify sheets) on mobile: it used `h-full`/`vh` units, which can leave it shorter than the actual visible viewport once the browser's address bar reappears, exposing the page behind it; and its own scroll container conflicted with callers (like the admin chat) that manage their own internal header/scroll-area/composer layout, letting the whole sheet drag out of place instead of only its content area scrolling. Switched to dynamic viewport units and contained overscroll so scrolling inside the sheet no longer chains to the page underneath.

## 0.2.2

### Patch Changes

- Updated dependencies [105a819]
  - @aether-commerce/core@0.2.2

## 0.2.1

### Patch Changes

- @aether-commerce/core@0.2.1
