"use client";
/**
 * LockedFeature — Overlay di upselling per funzionalità non incluse nel piano.
 *
 * Varianti:
 *  - "overlay": copre il contenuto con un blur + lucchetto (per widget dashboard)
 *  - "replace": sostituisce completamente l'elemento (per voci sidebar)
 *  - "badge": mostra solo un badge "Pro" / "Enterprise" inline
 */

import * as React from "react";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_META, type PlanTier } from "@/lib/plans";

interface LockedFeatureProps {
  minPlan:  PlanTier;
  message?: string;
  variant?: "overlay" | "replace" | "badge";
  children?: React.ReactNode;
  className?: string;
}

// Badge inline (es. accanto a voce sidebar)
export function PlanBadge({ plan }: { plan: PlanTier }) {
  const meta = PLAN_META[plan];
  return (
    <span className={cn(
      "ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full",
      meta.color, meta.textColor,
    )}>
      {meta.label}
    </span>
  );
}

// Overlay completo per widget bloccati
export function LockedFeature({
  minPlan,
  message,
  variant = "overlay",
  children,
  className,
}: LockedFeatureProps) {
  const meta    = PLAN_META[minPlan];
  const label   = meta.upgradeLabel ?? `Passa a ${meta.label}`;
  const msg     = message ?? `Questa funzionalità è inclusa nel piano ${meta.label}.`;

  if (variant === "badge") {
    return <PlanBadge plan={minPlan} />;
  }

  if (variant === "replace") {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        "text-muted-foreground/50 cursor-not-allowed select-none",
        className,
      )}>
        <Lock className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-sm">{children}</span>
        <PlanBadge plan={minPlan} />
      </div>
    );
  }

  // variant === "overlay" — usato per widget dashboard
  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-xl", className)}>
      {/* Contenuto sfocato dietro */}
      <div className="absolute inset-0 blur-sm opacity-30 pointer-events-none select-none">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 bg-background/60 backdrop-blur-[2px]">
        <div className={cn(
          "h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg",
          meta.color,
        )}>
          <Lock className={cn("h-6 w-6", meta.textColor)} />
        </div>

        <div className="text-center space-y-1 max-w-[180px]">
          <p className="text-sm font-semibold text-foreground leading-snug">{msg}</p>
        </div>

        <a
          href="/billing"
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold",
            "bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-md",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {label}
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
