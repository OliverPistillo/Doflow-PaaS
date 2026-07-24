"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusTone } from "./administration-model";

const iconTones = {
  violet: "bg-violet-100 text-violet-600",
  blue: "bg-blue-100 text-blue-600",
  green: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  red: "bg-rose-100 text-rose-600",
} as const;

export function AdministrationPageHeader({
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

export function AdministrationKpi({
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
  tone?: keyof typeof iconTones;
}) {
  return (
    <article className="min-h-[132px] rounded-2xl border border-slate-200/80 bg-white p-5">
      <div className="flex items-start gap-4">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", iconTones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="mt-1 text-[29px] font-bold leading-none tracking-tight text-slate-950">{value}</p>
          {hint ? <p className="mt-3 text-xs leading-5 text-slate-500">{hint}</p> : null}
        </div>
      </div>
    </article>
  );
}

export function AdministrationPanel({
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

export function AdministrationBadge({
  value,
  label,
}: {
  value?: string | null;
  label?: string;
}) {
  const tone = statusTone(value);
  const classes = {
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    red: "border-rose-200 bg-rose-50 text-rose-700",
  }[tone];
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", classes)}>{label || value || "Non definito"}</span>;
}

export function AdministrationEmpty({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center text-sm text-slate-500", className)}>
      {children}
    </div>
  );
}

export function AdministrationLoading() {
  return <div className="flex min-h-36 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Caricamento…</div>;
}

export function AdministrationError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>;
}
