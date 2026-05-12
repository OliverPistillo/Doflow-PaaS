## 2026-05-12 - [UX Consistency & Accessibility]
**Learning:** Some core pages like `LoginForm` were found to use native HTML elements (like `input type="checkbox"`) instead of the shared design system components (`Checkbox`). Additionally, `TooltipProvider` was missing from the root layout, preventing the use of accessible tooltips across the application.
**Action:** Always verify if a themed component exists in `src/components/ui` before using native elements. Ensure `TooltipProvider` is present in the root layout to support contextual help for icon-only buttons.
