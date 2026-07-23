"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TenantModuleKey } from "@/lib/tenant-access-api";
import { cn } from "@/lib/utils";

export type SourceFlags = Record<string, boolean>;

export type ActivityItem = {
  title: string;
  meta: string;
  createdAt: string | null;
};

export type DashboardMetric = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
};

export type DashboardQuickAction = {
  label: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  moduleKey?: TenantModuleKey;
  disabled?: boolean;
  note?: string;
};

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function hasSource(sources: SourceFlags): boolean {
  return Object.values(sources || {}).some(Boolean);
}

function metricsAreZero(metrics: DashboardMetric[]): boolean {
  return metrics.every((metric) => {
    if (typeof metric.value === "number") return metric.value === 0;
    if (metric.value === "-") return true;
    const numericValue = metric.value.replace(/[^\d,.-]/g, "").replace(",", ".");
    return numericValue !== "" && Number(numericValue) === 0;
  });
}

export function DashboardSectionCard({
  title,
  description,
  icon: Icon,
  metrics,
  sources,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  metrics: DashboardMetric[];
  sources?: SourceFlags;
  emptyText: string;
  children?: ReactNode;
}) {
  const isFallback = !hasSource(sources || {}) && metricsAreZero(metrics);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
        </div>
        {isFallback ? (
          <Badge variant="outline" className="shrink-0 border-border text-muted-foreground">
            In attesa dati
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
              <p className="text-xs font-semibold text-muted-foreground">{metric.label}</p>
              <p
                className={cn(
                  "mt-1 text-xl font-bold tabular-nums text-foreground",
                  metric.tone === "danger" && "text-destructive",
                  metric.tone === "warning" && "text-chart-5",
                  metric.tone === "success" && "text-chart-2",
                )}
              >
                {metric.value}
              </p>
              {metric.hint ? <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p> : null}
            </div>
          ))}
        </div>
        {children}
        {isFallback ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DashboardActivityList({
  title,
  items,
  empty,
  icon: Icon,
}: {
  title: string;
  items: ActivityItem[];
  empty: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {empty}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.meta}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardQuickActions({ actions }: { actions: DashboardQuickAction[] }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Azioni rapide</CardTitle>
        <CardDescription>Comandi operativi per il lavoro interno doflow.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;
            const content = (
              <Button
                variant="outline"
                className="h-auto w-full justify-between gap-3 px-4 py-3"
                disabled={action.disabled}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{action.label}</span>
                </span>
                {action.disabled ? (
                  <Badge variant="outline" className="shrink-0">
                    In arrivo
                  </Badge>
                ) : (
                  <ArrowRight className="h-4 w-4 shrink-0" />
                )}
              </Button>
            );

            return action.href && !action.disabled ? (
              <Link key={action.label} href={action.href}>
                {content}
              </Link>
            ) : (
              <div key={action.label} title={action.note}>
                {content}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPriorityStrip({
  items,
}: {
  items: Array<{
    label: string;
    value: number | string;
    href: string;
    icon: ComponentType<{ className?: string }>;
    tone?: "danger" | "warning" | "success";
  }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "group rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/35 hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              item.tone === "danger" && "border-destructive/30 bg-destructive/5 hover:border-destructive/50",
              item.tone === "warning" && "border-chart-5/30 bg-chart-5/5 hover:border-chart-5/50",
              item.tone === "success" && "border-chart-2/30 bg-chart-2/5 hover:border-chart-2/50",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{item.value}</p>
              </div>
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
