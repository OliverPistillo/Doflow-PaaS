// Percorso: apps/frontend/src/components/ui/card.tsx
// Refactored 1:1 dal Figma:
//   elm/card/main  → bg white, radius 24px, shadow 0px 6px 58px rgba(196,203,214,0.10)
//   elm/card/gray  → bg #f4f9fd, radius 24px, no shadow

import * as React from "react";
import { cn } from "@/lib/utils";

// ── Card root (Figma: elm/card/main) ──────────────────────────────────────────
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "df-glass-panel df-glass-panel-hover text-card-foreground rounded-card",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

// ── CardHeader ────────────────────────────────────────────────────────────────
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-1.5 p-6",
      className
    )}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

// ── CardTitle (Figma: 22px Bold #0a1629 — df-section-title) ──────────────────
const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-[22px] font-bold leading-tight tracking-normal text-foreground",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

// ── CardDescription (Figma: 14px Regular #7d8592) ────────────────────────────
const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-sm text-muted-foreground leading-snug",
      className
    )}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

// ── CardContent ───────────────────────────────────────────────────────────────
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-6 pt-0", className)}
    {...props}
  />
));
CardContent.displayName = "CardContent";

// ── CardFooter ────────────────────────────────────────────────────────────────
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

// ── GrayCard (Figma: elm/card/gray — bg #f4f9fd) ─────────────────────────────
// Variante secondaria usata per celle interne (es. Workload employee cards)
const GrayCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "df-soft-panel rounded-card",
      className
    )}
    {...props}
  />
));
GrayCard.displayName = "GrayCard";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  GrayCard,
};