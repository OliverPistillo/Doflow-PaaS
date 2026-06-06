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
## 2026-05-13 - [Modernizing Legacy Auth Pages]
**Learning:** Legacy auth pages (like the original `forgot-password`) that use hardcoded dark themes (zinc-700/800, bg-black) clash with the modernized "warm neutral" and glassmorphism design system. Modernizing these pages requires wrapping them in the `doflow-app-frame`, using `df-glass-panel` for containers, and replacing raw HTML elements with themed `Input` and `Button` components.
**Action:** Always check for legacy hardcoded styles in auth-related pages and replace them with the design system's utility classes and components to ensure theme consistency and better UX.

## 2026-05-20 - [Accessible MFA Setup Fallback]
**Learning:** Providing a "Copy Secret" feature alongside the MFA QR code is a critical accessibility and UX improvement. It ensures users who cannot scan images (due to device limitations or visual impairments) have a seamless path to manually configure their authenticator app.
**Action:** Always include a one-click copy button for manual entry codes in setup flows, using the design system's `toast` for immediate success feedback.

## 2026-05-21 - [Semantic Theming & Tooltip Ref Forwarding]
**Learning:** Modernizing legacy components requires replacing hardcoded brand colors (e.g., `indigo-600`) with semantic tokens (`primary`) for theme compatibility. Additionally, when wrapping custom functional components in a `TooltipTrigger`, a `div` wrapper is often necessary to avoid ref-forwarding issues if the component doesn't explicitly implement `React.forwardRef`.
**Action:** Always prefer semantic tokens for colors and use a `div` wrapper for tooltips around complex custom components.

## 2026-05-22 - [Standardized Layouts & Semantic Tokens]
**Learning:** Modernizing fragmented legacy pages (like Settings) using shared layout components (`PageShell`, `PageHeader`) and semantic tokens (`primary`, `destructive`) instead of hardcoded colors ensures consistent padding, visual language, and theme compatibility (e.g., dark mode) across the app.
**Action:** Always refactor legacy pages to use `PageShell` and semantic tokens to maintain design system integrity.

## 2026-05-23 - [OTP Chunking & Descriptive Auth Tooltips]
**Learning:** Dividing a long numeric input (like a 6-digit MFA code) into smaller "chunks" using a separator reduces cognitive load and helps users verify their entry more accurately. Additionally, standardizing on descriptive tooltip labels for authentication-related actions (e.g., "Mostra password" instead of just "Mostra") provides better clarity and accessibility across the application.
**Action:** Use 'InputOTPSeparator' to split numeric codes into groups of 3. Always prefer descriptive tooltip labels (Action + Object) for sensitive interactions in authentication flows.
## 2026-06-04 - [Centralized Platform-Aware Shortcuts]
**Learning:** Hardcoding platform-specific symbols like '⌘' in tooltips and ARIA labels provides a poor experience for non-Mac users. Using a centralized hook to detect the platform allows for dynamic, accessible shortcuts (e.g., 'Ctrl+K' vs '⌘K') and descriptive ARIA labels (e.g., 'Control+K' vs 'Command+K') that improve clarity for all users.
**Action:** Always use the 'usePlatform' hook for any component that displays or handles keyboard shortcuts to ensure consistent cross-platform behavior and better accessibility.

## 2026-06-06 - [Flicker Prevention in Parameter-Dependent Pages]
**Learning:** To prevent flickering of "Invalid Link" or "Error" states on pages that depend on URL parameters (like tokens), using an `initializing` state that remains `true` until `useEffect` has finished reading from the URL ensures a smooth, professional entrance.
**Action:** Always use an `initializing` state with a centered loader for any page that conditionally renders error states based on URL parameter presence.

## 2026-06-05 - [Auth Flow Friction & Redirection Feedback]
**Learning:** Adding 'autoFocus' to the primary input of authentication forms (Login/Register) reduces friction by allowing users to type immediately. For post-action states (like successful registration), providing a clear, animated, and accessible success container (using 'role="status"') with a loading indicator for the redirect process improves perceived performance and user confidence.
**Action:** Always include 'autoFocus' on the first field of interactive forms. Use an animated success state with 'role="status"' and redirection feedback for critical auth transitions.
