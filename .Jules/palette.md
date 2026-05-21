## 2025-05-14 - Redundant Accessibility in Interactive Elements
**Learning:** Adding both an `aria-label` and an internal `sr-only` span to the same button causes screen readers to announce the label twice. Standardizing on one method (preferably `sr-only` for complex icons) ensures a cleaner experience for users with assistive technologies.
**Action:** Use only one accessibility labeling method per interactive element. In Radix-based components, favor internal hidden spans when the button wraps an icon.

## 2025-05-14 - Global Tooltip Provider in Next.js
**Learning:** Radix UI's Tooltip requires a `TooltipProvider` to be present in the tree. Placing it in the root layout (`app/layout.tsx`) enables tooltips across all modules (Tenant, Superadmin, etc.) without repeated setup.
**Action:** Always verify the presence of a global `TooltipProvider` when implementing Tooltips in a multi-layout application.
## 2025-05-15 - Dynamic Tooltips for Sidebar Control
**Learning:** Tooltips should be context-aware; providing different labels for different states (e.g., 'Expand' vs 'Collapse') improves clarity for icon-only controls.
**Action:** Always check if an icon-only control has multiple states and implement dynamic tooltips using Radix UI's `Tooltip` and component state.
## 2025-05-14 - Tooltips and Localization for Persistent UI
**Learning:** Adding tooltips to icon-only buttons in the persistent UI (Sidebar, Header) significantly improves discoverability and accessibility, especially when paired with localized ARIA labels and keyboard shortcut hints. Using a global `TooltipProvider` in the root layout ensures consistent behavior across the application.
**Action:** Always wrap the root layout in a `TooltipProvider` and provide dynamic tooltips for state-dependent toggles (like the Sidebar trigger).
## 2026-05-19 - [Improved MFA Input Experience]
**Learning:** Replacing generic text inputs with specialized components like `InputOTP` for 2FA/MFA significantly improves both usability and perceived security. Adding visual affordance (e.g., icons) to navigation links like "Back to login" reduces cognitive load.
**Action:** Always prefer the `InputOTP` suite for fixed-length codes and ensure they have a descriptive `aria-label` for screen readers.
## 2025-05-15 - Global Tooltip Provider and Ref Handling
**Learning:** In Next.js applications using Radix UI/shadcn, it's more efficient and prevents state conflicts to place a single `TooltipProvider` at the root layout rather than repeating it in every page or component. Additionally, when wrapping complex or third-party components (like `ThemeSettingsDrawer`) in a `TooltipTrigger`, using a `div` wrapper ensures the tooltip works even if the component doesn't correctly forward its ref.
**Action:** Always check if a root `TooltipProvider` exists before adding new tooltips. Use a `div` wrapper inside `TooltipTrigger` for custom components to avoid "Function components cannot be given refs" warnings or silent failures.
