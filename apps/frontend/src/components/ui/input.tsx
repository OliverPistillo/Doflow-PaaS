// Percorso: apps/frontend/src/components/ui/input.tsx
// Refactored 1:1 dal Figma:
//   elm/general/field/gray → bg #f4f9fd, border-radius 14px, no border in default
//   Search field           → bg white, radius 14px, shadow-card
//   Font: 16px SemiBold Nunito Sans, color #0a1629 | placeholder #7d8592

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Use the gray (secondary) field variant from Figma */
  variant?: "default" | "gray";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "default", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // ── Base (matches Figma search field) ──────────────────
          "flex w-full",
          "h-12",                                    // 48px — Figma search/field height
          "rounded-[var(--radius)]",                 // 14px — same as button
          "px-4 py-3",
          "text-[16px] font-semibold leading-normal", // Figma: SemiBold 16px
          "text-foreground",
          "placeholder:text-muted-foreground",
          "outline-none",
          "transition-all duration-150",

          // ── Focus ring ─────────────────────────────────────────
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",

          // ── Disabled ───────────────────────────────────────────
          "disabled:pointer-events-none disabled:opacity-50",

          // ── File input reset ───────────────────────────────────
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",

          // ── Variant: default (Figma: white bg, shadow-card) ────
          variant === "default" && [
            "bg-input",                  // white in light, dark in dark mode
            "border border-border",
            "shadow-sm",
            "hover:border-primary/40",
            "focus-visible:border-primary",
          ],

          // ── Variant: gray (Figma: elm/general/field/gray #f4f9fd) ──
          variant === "gray" && [
            "bg-figma-gray dark:bg-muted",
            "border border-transparent",
            "focus-visible:border-primary/50",
          ],

          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };