## 2026-05-13 - Add global tooltips to icon-only layout buttons
**Learning:** Icon-only buttons (Sidebar toggle, Notifications, Theme Settings) in global layouts lack immediate textual context for sighted users. Providing tooltips significantly improves the intuitiveness of the interface without cluttering it with text labels.
**Action:** Always wrap global icon-only actions in a Tooltip component, ensuring labels are localized and consistent with existing UI patterns.
## 2026-05-12 - [UX Consistency & Accessibility]
**Learning:** Some core pages like `LoginForm` were found to use native HTML elements (like `input type="checkbox"`) instead of the shared design system components (`Checkbox`). Additionally, `TooltipProvider` was missing from the root layout, preventing the use of accessible tooltips across the application.
**Action:** Always verify if a themed component exists in `src/components/ui` before using native elements. Ensure `TooltipProvider` is present in the root layout to support contextual help for icon-only buttons.
## 2025-05-17 - [Global Tooltip Configuration]
**Learning:** Radix UI's `Tooltip` components require a `TooltipProvider` to be present in the component tree. Implementing it at the root layout (`apps/frontend/src/app/layout.tsx`) prevents redundant provider declarations in sub-layouts, ensuring consistent behavior (like `delayDuration`) and avoiding potential state conflicts or hydration issues across the app.
**Action:** Always verify if a global `TooltipProvider` exists in the root layout before adding tooltips. If not, centralize it there instead of adding local providers to individual components or nested layouts.
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

## 2025-05-20 - [Platform-Aware Keyboard Shortcuts]
**Learning:** Hardcoding Macintosh symbols (⌘) or "Ctrl" text for keyboard shortcuts alienates users on other platforms. Implementing a platform-aware hook (detecting `window.navigator.platform`) allows for dynamic rendering of symbols (⌘ vs Ctrl) and labels (Command vs Control), significantly improving accessibility and clarity for all users.
**Action:** Use a centralized `usePlatform` hook to determine the correct modifier key and label for shortcuts. When providing accessibility labels (like `aria-label`), favor full text (e.g., "Control + K") over symbols or abbreviations for better screen reader support.

## 2026-05-21 - [Delightful Auth Redirects]
**Learning:** Abrupt redirects after critical actions like accepting an invite can be jarring and leave users unsure if the action succeeded. Implementing a temporary success state (2s) with the design system's checkmark pattern (`df-icon-bubble` + `animate-fadeInUp`) provides delightful feedback and ensures the user feels in control.
**Action:** Always implement a brief success state before automatic redirects in critical authentication or destructive flows.

## 2026-06-20 - [Standardizing MFA with V2 Design System]
**Learning:** Hardcoded legacy styles (e.g., bg-slate-50, bg-indigo-600) in peripheral auth pages like MFA create a disjointed UX when the rest of the application has migrated to a glassmorphism-based design system. Always check for the 'doflow-app-frame' and 'df-glass-panel' patterns to ensure visual continuity.
**Action:** Use 'df-glass-panel' for all authentication-related cards and 'df-icon-bubble' for primary header icons to maintain design system consistency.

## 2025-05-22 - [Dashboard Search Shortcut Pattern]
**Learning:** In data-heavy management dashboards, providing a quick keyboard shortcut to focus the search input significantly improves the experience for power users. Using the '/' key (without modifiers) is a widely recognized convention. Pair this with a visual `<kbd>` hint and ensure the listener ignores triggers when focusing other inputs to avoid collision.
**Action:** Standardize search inputs with a `/` shortcut and a visible keyboard hint. Use `useRef` to target the input and an event listener on the `window` object for the shortcut.
