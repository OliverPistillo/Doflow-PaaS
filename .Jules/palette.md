## 2025-05-14 - [User Menu Modernization & Status Accessibility]
**Learning:** Modernizing legacy components like UserNav requires balancing visual parity with new design tokens while ensuring accessibility via Tooltips and proper ARIA labels. Icon-only triggers should always be wrapped in Tooltips for desktop discoverability. For live status indicators, keep text labels accessible even if the pulsing animation is decorative and hidden.
**Action:** Always wrap UserNav triggers in Tooltips and use themed tokens (bg-primary/10) instead of hardcoded colors for consistency with the v2 design system.

## 2026-06-25 - [Notifications Modernization & PageShell Adoption]
**Learning:** Adoption of centralized components like `PageShell`, `PageHeader`, `LoadingState`, and `EmptyState` dramatically reduces boilerplate and ensures visual parity with the v2 design language. For dynamic pages like Notifications, providing a manual "Refresh" action in the header alongside WebSocket support improves user confidence. Always ensure icon-only actions (like "Mark as read") have both `sr-only` text for screen readers and tooltips for sighted users.
**Action:** Use `PageShell` and `PageHeader` for all new or refactored tenant-facing pages to maintain a premium, consistent look and feel.
