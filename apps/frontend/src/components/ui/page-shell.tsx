// Percorso: apps/frontend/src/components/ui/page-shell.tsx
// Componente condiviso: wrapper di pagina con loading skeleton, error state,
// empty state. Elimina il copy-paste di questi pattern in ogni page.tsx.

"use client";

import * as React from "react";
import { Loader2, AlertTriangle, RefreshCw, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── PageShell ────────────────────────────────────────────────────────────────
// Wrapper radice per tutte le pagine tenant: padding consistente + animazione

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  /** Padding laterale (default true) */
  padded?: boolean;
}

export function PageShell({ children, className, padded = true }: PageShellProps) {
  return (
    <div
      className={cn(
        "doflow-page-shell flex flex-col gap-6 animate-fade-in",
        padded && "p-4 sm:p-6 lg:p-8",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Slot per pulsanti a destra */
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="df-page-hero flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
      <div className="min-w-0 space-y-4">
        <div className="df-page-eyebrow">Doflow Workspace</div>
        <h1 className="df-page-title truncate tracking-tight">{title}</h1>
        {description && (
          <p className="df-page-description text-balance">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 shrink-0 flex-wrap lg:justify-end pb-1">{actions}</div>
      )}
    </div>
  );
}

// ─── LoadingState ─────────────────────────────────────────────────────────────

interface LoadingStateProps {
  /** Numero di righe skeleton da mostrare */
  rows?: number;
  /** Layout alternativo centrato (per pagine full-height) */
  centered?: boolean;
  label?: string;
}

export function LoadingState({ rows = 5, centered = false, label }: LoadingStateProps) {
  if (centered) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        {label && <p className="text-sm animate-pulse">{label}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3" role="status" aria-label="Caricamento...">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="df-glass-panel flex items-center gap-3 p-4 rounded-card">
          <Skeleton className="h-10 w-10 rounded-nav shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── TableLoadingState ────────────────────────────────────────────────────────
// Skeleton per tabelle (righe con celle)

export function TableLoadingState({ cols = 4, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <div className="df-glass-panel overflow-hidden" role="status" aria-label="Caricamento...">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 bg-muted/40 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i === 0 ? "flex-1" : "w-20"}`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border/50 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className={j === 0 ? "flex-1 flex items-center gap-3" : "w-20"}>
              {j === 0 && <Skeleton className="h-8 w-8 rounded-nav shrink-0" />}
              <Skeleton className={`h-4 ${j === 0 ? "flex-1" : "w-full"}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── ErrorState ───────────────────────────────────────────────────────────────

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Impossibile caricare i dati",
  message = "Si è verificato un errore durante il caricamento. Riprova.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="df-glass-panel flex flex-col items-center justify-center min-h-[30vh] gap-6 border-dashed p-10">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
      </div>
      <div className="text-center max-w-sm space-y-2">
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Riprova
        </Button>
      )}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

export function EmptyState({
  title = "Nessun dato",
  message = "Non ci sono ancora elementi in questa sezione.",
  action,
  icon: Icon = PackageOpen,
}: EmptyStateProps) {
  return (
    <div className="df-glass-panel flex flex-col items-center justify-center min-h-[24vh] gap-4 border-dashed p-10">
      <div className="df-icon-bubble h-14 w-14">
        <Icon className="h-7 w-7 text-primary/60" aria-hidden="true" />
      </div>
      <div className="text-center max-w-xs space-y-1">
        <p className="text-lg font-bold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
      </div>
      {action}
    </div>
  );
}

// ─── KpiSkeleton ──────────────────────────────────────────────────────────────
// Skeleton per la griglia KPI (4 card)

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="status" aria-label="Caricamento metriche...">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="df-kpi-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-8 rounded-nav" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}