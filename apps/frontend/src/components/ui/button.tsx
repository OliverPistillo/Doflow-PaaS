// Percorso: apps/frontend/src/components/ui/button.tsx
// Refactored 1:1 dal Figma: elm/button/mainbutton
//   radius:  14px  (var(--radius))
//   shadow:  0px 6px 12px rgba(63,140,255,0.26)
//   font:    Bold 16px Nunito Sans
//   bg:      #052136 → hsl(var(--primary))

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: Figma button geometry + typography
  [
    "inline-flex items-center justify-center gap-2",
    "whitespace-nowrap",
    "rounded-[var(--radius)]",            // 14px — Figma elm/button/mainbutton
    "text-[16px] font-bold",              // Figma: Bold 16px Nunito Sans
    "leading-normal",
    "transition-all duration-150 ease-out",
    "focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        // ── Primary (Figma: elm/button/mainbutton) ────────────────
        default:
          "bg-gradient-to-br from-primary via-primary to-chart-4 text-primary-foreground shadow-button hover:shadow-lg hover:opacity-95 hover:-translate-y-px active:translate-y-0",

        // ── Destructive ───────────────────────────────────────────
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90",

        // ── Outline (ghost with border) ───────────────────────────
        outline:
          "border border-border/70 bg-card/65 text-foreground shadow-sm backdrop-blur-xl hover:bg-primary/10 hover:border-primary/30 hover:text-primary",

        // ── Secondary (Figma: card-gray bg) ───────────────────────
        secondary:
          "bg-secondary/70 text-secondary-foreground shadow-sm backdrop-blur-xl hover:bg-secondary hover:-translate-y-px",

        // ── Ghost ─────────────────────────────────────────────────
        ghost:
          "text-muted-foreground hover:bg-primary/10 hover:text-primary",

        // ── Link ──────────────────────────────────────────────────
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto shadow-none",
      },
      size: {
        // Figma button height: 48px
        default: "h-12 px-6 py-3",       // 48px — matches Figma mainbutton
        sm:      "h-9 px-4 text-sm font-semibold",
        lg:      "h-14 px-8 text-lg",
        icon:    "h-10 w-10 text-base",
        xs:      "h-7 px-3 text-xs font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };