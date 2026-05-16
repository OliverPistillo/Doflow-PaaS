## 2025-05-14 - Tooltips and Localization for Persistent UI
**Learning:** Adding tooltips to icon-only buttons in the persistent UI (Sidebar, Header) significantly improves discoverability and accessibility, especially when paired with localized ARIA labels and keyboard shortcut hints. Using a global `TooltipProvider` in the root layout ensures consistent behavior across the application.
**Action:** Always wrap the root layout in a `TooltipProvider` and provide dynamic tooltips for state-dependent toggles (like the Sidebar trigger).
