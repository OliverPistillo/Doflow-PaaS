"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Plus } from "lucide-react";
import { getInitials } from "@/lib/jwt";
import { cn } from "@/lib/utils";
import { optionLabel, PRIORITIES, PROJECT_STATUSES, TASK_STATUSES } from "./work-model";

export function WorkPageHeader({
  title,
  description,
  ctaLabel,
  ctaHref,
  canCreate = true,
  children,
}: {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  canCreate?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-[30px] font-bold leading-tight tracking-normal text-slate-950">{title}</h1>
        <p className="mt-1 text-[15px] text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {canCreate && ctaLabel && ctaHref ? (
          <Link
            href={ctaHref}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

const tones = {
  violet: "bg-violet-100 text-violet-600",
  blue: "bg-blue-100 text-blue-600",
  green: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  red: "bg-rose-100 text-rose-600",
} as const;

export function WorkKpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "violet",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: keyof typeof tones;
}) {
  return (
    <article className="min-h-[142px] rounded-2xl border border-slate-200/80 bg-white p-5">
      <div className="flex items-start gap-4">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", tones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="mt-1 text-[30px] font-bold leading-none text-slate-950">{value}</p>
          {hint ? <p className="mt-3 text-xs leading-5 text-slate-500">{hint}</p> : null}
        </div>
      </div>
    </article>
  );
}

export function WorkSection({
  title,
  actionHref,
  actionLabel,
  className,
  children,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-slate-200/80 bg-white p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-slate-950">{title}</h2>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
            {actionLabel}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function WorkAvatar({
  name,
  email,
  size = "md",
  className,
}: {
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const label = name || email || "Non assegnato";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 font-semibold text-indigo-600",
        size === "sm" && "h-7 w-7 text-[10px]",
        size === "md" && "h-9 w-9 text-xs",
        size === "lg" && "h-11 w-11 text-sm",
        className,
      )}
    >
      {getInitials(email || undefined, name || undefined)}
    </span>
  );
}

export function SoftBadge({
  children,
  tone = "slate",
  className,
}: {
  children: React.ReactNode;
  tone?: "slate" | "violet" | "blue" | "green" | "orange" | "red";
  className?: string;
}) {
  const toneClass = {
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    red: "border-rose-200 bg-rose-50 text-rose-700",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium", toneClass, className)}>
      {children}
    </span>
  );
}

export function ProjectStatusBadge({ value }: { value?: string | null }) {
  const tone = value === "blocked"
    ? "red"
    : ["delivered", "closed"].includes(String(value || ""))
      ? "green"
      : ["publishing", "training"].includes(String(value || ""))
        ? "orange"
        : "slate";
  return <SoftBadge tone={tone}>{optionLabel(PROJECT_STATUSES, value)}</SoftBadge>;
}

export function TaskStatusBadge({ value }: { value?: string | null }) {
  const tone = value === "done"
    ? "green"
    : value === "blocked"
      ? "red"
      : ["internal_review", "client_review"].includes(String(value || ""))
        ? "orange"
        : value === "in_progress"
          ? "blue"
          : "slate";
  return <SoftBadge tone={tone}>{optionLabel(TASK_STATUSES, value)}</SoftBadge>;
}

export function PriorityBadge({ value }: { value?: string | null }) {
  const tone = value === "urgent" ? "red" : value === "high" ? "orange" : value === "medium" ? "violet" : "green";
  return <SoftBadge tone={tone}>{optionLabel(PRIORITIES, value)}</SoftBadge>;
}

export function WorkEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function WorkProgress({ value, danger = false, className }: { value?: number | string | null; danger?: boolean; className?: string }) {
  const percent = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full", danger ? "bg-rose-500" : "bg-indigo-600")} style={{ width: `${percent}%` }} />
    </div>
  );
}
