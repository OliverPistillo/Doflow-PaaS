"use client";

import type { ComponentType, HTMLAttributes, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
};

const toneTextClasses: Record<Tone, string> = {
  default: "text-muted-foreground",
  success: "text-emerald-600 dark:text-emerald-300",
  warning: "text-amber-600 dark:text-amber-300",
  danger: "text-rose-600 dark:text-rose-300",
  info: "text-blue-600 dark:text-blue-300",
};

export function WorkspaceSectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-normal text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function KpiStatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  hint?: string;
  trend?: "up" | "down" | "flat";
  tone?: Tone;
  className?: string;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;

  return (
    <Card className={cn("df-kpi-card min-w-0", className)}>
      <CardContent className="flex min-h-[112px] items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-[26px] font-bold leading-none tracking-normal tabular-nums text-foreground">
            {value}
          </p>
          {hint ? (
            <p className={cn("mt-2 flex items-center gap-1 text-[11px] font-medium", toneTextClasses[tone])}>
              <TrendIcon className="h-3 w-3" aria-hidden="true" />
              <span className="truncate">{hint}</span>
            </p>
          ) : null}
        </div>
        {Icon ? (
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneClasses[tone])}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function KpiGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

export function WorkspaceFilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center", className)}>
      {children}
    </div>
  );
}

export function WorkspaceTableShell({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}
      {...props}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function WorkspaceStatusBadge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-0 px-2 py-0.5 text-[11px] font-medium shadow-none", toneClasses[tone], className)}
    >
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {children}
    </Badge>
  );
}

export function WorkspaceSideDetailCard({
  title,
  eyebrow,
  actions,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("h-fit xl:sticky xl:top-20", className)}>
      <CardHeader className="border-b border-border p-4">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</p> : null}
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {children}
        {actions ? <div className="grid gap-2 border-t border-border pt-4">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}

export function WorkspaceChartCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-3 p-4">
        <WorkspaceSectionHeader title={title} description={description} />
        {actions}
      </CardHeader>
      <CardContent className="p-4 pt-0">{children}</CardContent>
    </Card>
  );
}

export function WorkspaceCtaBar({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center md:justify-between", className)}>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}
