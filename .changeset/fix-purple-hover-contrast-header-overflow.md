---
"@aether-commerce/admin-default": patch
---

Fix illegible dark text on purple backgrounds in the admin panel: the legacy `hover:bg-zinc-100` repaint (used by light/bordered secondary buttons like the checkout provider toggle) was incorrectly bundled with `hover:bg-zinc-800` and repainted to the purple accent-hover color instead of the intended light gray, which is especially visible as a stuck `:hover` state after a tap on mobile. Also fix the page header's action buttons (e.g. "New WhatsApp order") overflowing past the viewport edge on mobile instead of wrapping.
