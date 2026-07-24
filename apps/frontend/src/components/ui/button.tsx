// Percorso: apps/frontend/src/components/ui/button.tsx
// Doflow UI Review v2
//   radius: 14px, Inter 600, warm neutral surfaces, indigo accent

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
    "text-[14px] font-semibold",
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
          "bg-gradient-to-br from-primary via-primary to-chart-4 text-primary-foreground shadow-button hover:opacity-90 hover:-translate-y-px active:translate-y-0",

        // ── Destructive ───────────────────────────────────────────
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90",

        // ── Outline (ghost with border) ───────────────────────────
        outline:
          "border border-border bg-card/50 backdrop-blur-md text-foreground shadow-sm hover:bg-secondary/80 hover:border-input",

        // ── Secondary (Figma: card-gray bg) ───────────────────────
        secondary:
          "bg-secondary/60 backdrop-blur-md text-secondary-foreground border border-border shadow-sm hover:bg-secondary/80 hover:-translate-y-px",

        // ── Ghost ─────────────────────────────────────────────────
        ghost:
          "text-muted-foreground hover:bg-secondary hover:text-foreground",

        // ── Link ──────────────────────────────────────────────────
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto shadow-none",
      },
      size: {
        // Figma button height: 48px
        default: "h-10 px-5 py-2",
        sm:      "h-8 px-3 text-xs font-semibold",
        lg:      "h-12 px-7 text-base",
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