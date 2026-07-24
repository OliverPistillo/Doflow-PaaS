"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Loader2, Plus } from "lucide-react";

const toneClasses = {
  violet: "bg-violet-50 text-violet-600",
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  orange: "bg-orange-50 text-orange-600",
  red: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
};

export type SettingsTone = keyof typeof toneClasses;

export function SettingsPageHeader({
  title,
  description,
  actionLabel,
  actionHref,
  actionIcon: ActionIcon = Plus,
  canAct = false,
  children,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  actionIcon?: LucideIcon;
  canAct?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {children}
        {canAct && actionHref && actionLabel ? (
          <Link href={actionHref} className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700">
            <ActionIcon className="h-4 w-4" />
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

export function SettingsKpi({
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
  tone?: SettingsTone;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <div className="flex items-start gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function SettingsPanel({
  title,
  description,
  children,
  className = "",
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SettingsBadge({ label, tone = "slate" }: { label: React.ReactNode; tone?: SettingsTone }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{label}</span>;
}

export function SettingsLoading() {
  return <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200/80 bg-white"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>;
}

export function SettingsError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{message}</span></div>;
}

export function SettingsEmpty({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-500 ${className}`}>{children}</div>;
}

export function Initials({ name, className = "" }: { name?: string | null; className?: string }) {
  const value = String(name || "Doflow").trim().split(/\s+/).slice(0, 2).map((item) => item[0]).join("").toUpperCase();
  return <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 ${className}`}>{value || "DF"}</span>;
}
