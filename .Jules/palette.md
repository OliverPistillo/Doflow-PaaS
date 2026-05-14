## 2025-05-14 - Redundant Accessibility in Interactive Elements
**Learning:** Adding both an `aria-label` and an internal `sr-only` span to the same button causes screen readers to announce the label twice. Standardizing on one method (preferably `sr-only` for complex icons) ensures a cleaner experience for users with assistive technologies.
**Action:** Use only one accessibility labeling method per interactive element. In Radix-based components, favor internal hidden spans when the button wraps an icon.

## 2025-05-14 - Global Tooltip Provider in Next.js
**Learning:** Radix UI's Tooltip requires a `TooltipProvider` to be present in the tree. Placing it in the root layout (`app/layout.tsx`) enables tooltips across all modules (Tenant, Superadmin, etc.) without repeated setup.
**Action:** Always verify the presence of a global `TooltipProvider` when implementing Tooltips in a multi-layout application.
