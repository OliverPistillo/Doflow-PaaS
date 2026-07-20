## 2025-05-14 - [User Menu Modernization & Status Accessibility]
**Learning:** Modernizing legacy components like UserNav requires balancing visual parity with new design tokens while ensuring accessibility via Tooltips and proper ARIA labels. Icon-only triggers should always be wrapped in Tooltips for desktop discoverability. For live status indicators, keep text labels accessible even if the pulsing animation is decorative and hidden.
**Action:** Always wrap UserNav triggers in Tooltips and use themed tokens (bg-primary/10) instead of hardcoded colors for consistency with the v2 design system.

## 2026-06-25 - [Notifications Modernization & PageShell Adoption]
**Learning:** Adoption of centralized components like `PageShell`, `PageHeader`, `LoadingState`, and `EmptyState` dramatically reduces boilerplate and ensures visual parity with the v2 design language. For dynamic pages like Notifications, providing a manual "Refresh" action in the header alongside WebSocket support improves user confidence. Always ensure icon-only actions (like "Mark as read") have both `sr-only` text for screen readers and tooltips for sighted users.
**Action:** Use `PageShell` and `PageHeader` for all new or refactored tenant-facing pages to maintain a premium, consistent look and feel.

## 2026-06-27 - [Search Accessibility & Shortcut Discoverability]
**Learning:** Implementing the '/' keyboard shortcut for search inputs is a high-value UX pattern that must be accompanied by a visual `<kbd>` indicator for discoverability. To ensure full accessibility, icon-only action buttons in tables should be visible on focus (`focus-visible`) and wrapped in Tooltips, while inputs must have explicit `id`s and `sr-only` labels.
**Action:** Always include a `<kbd>/</kbd>` indicator in search bars and ensure icon-only buttons are accessible to keyboard users via `focus-visible` and ARIA labels.

## 2026-06-28 - [Page Modernization & Search Accessibility]
**Learning:** Modernizing secondary pages like Campaigns to use centralized components (PageShell, PageHeader) ensures a premium, cohesive UI across the platform. Integrating keyboard shortcuts (e.g., '/') for search focus is a high-impact UX win that must be paired with clear accessibility markers like <kbd> indicators and screen-reader-only labels. Icon-only actions must always be wrapped in Tooltips and made visible on focus for full keyboard navigability.
**Action:** Prioritize wrapping icon-only detail triggers in Tooltips and use 'group-focus-within' to ensure visibility during keyboard navigation.

## 2026-06-29 - [Centralized CRM Modernization]
**Learning:** Modernizing a shared component like `CrmResourcePage` allows for sweeping UX and accessibility improvements across multiple routes (Companies, Contacts, Deals, Leads) with minimal code changes. Ensuring that search inputs have a globally consistent '/' shortcut and visual kbd indicator reinforces platform-wide muscle memory. Wrapping shared table actions in Tooltips with descriptive ARIA labels immediately elevates the accessibility of all CRM-based pages.
**Action:** When a design pattern is repeated across multiple pages, prefer modernizing the shared core component (e.g., `CrmResourcePage`) to ensure consistency and maintainability.

## 2026-06-30 - [Projects UX Deletions & Custom Confirm Dialogs]
**Learning:** Native `window.confirm` dialogs are highly inaccessible, lack unified styling, and degrade premium SaaS experiences. Replacing them with an accessible `AlertDialog` wrapper like the existing custom `useConfirm` hook ensures keyboard operability, screen reader support, and design continuity.
**Action:** Always replace legacy browser native confirm dialogs with the custom, accessible `ConfirmDialog` hook.

## 2026-07-01 - [Credentials UX Deletions & Modernized Confirmations]
**Learning:** In premium modules like Credentials/Vault, visual cohesion and accessible flows are vital. Extending the custom `useConfirm` hook to all secondary delete/archive sub-views (e.g. permission removal, entity unlinking, and card archiving) eliminates blocky legacy dialogs, enforces focus containment, and ensures full keyboard & screen-reader compliance.
**Action:** Use the custom `useConfirm` hook and mount `<ConfirmDialog />` across all workspace sub-components where destructive actions occur.
