"use client";

import { getDoFlowUser } from "@/lib/jwt";
import type { ReportParams } from "@/lib/tenant-reports-api";

export const REPORT_LABELS: Record<string, string> = {
  executive: "Direzione",
  sales: "Vendite",
  projects: "Progetti",
  finance: "Finance",
  team: "Team",
  documents: "Documenti",
  operations: "Operatività",
  customers: "Clienti",
};

export const GROUP_LABELS: Record<string, string> = {
  day: "Giorno",
  week: "Settimana",
  month: "Mese",
  quarter: "Trimestre",
};

export const KPI_STATUS_LABELS: Record<string, string> = {
  below: "Sotto target",
  on_track: "In linea",
  exceeded: "Superato",
};

export function canViewFinance(role = getDoFlowUser()?.role) {
  return ["owner", "admin", "superadmin", "super_admin"].includes(String(role || "").toLowerCase().trim());
}

export function formatNumber(value?: unknown) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("it-IT").format(Number.isFinite(number) ? number : 0);
}

export function formatCurrency(value?: unknown, currency = "EUR") {
  const number = Number(value || 0);
  return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(Number.isFinite(number) ? number : 0);
}

export function formatPercent(value?: unknown) {
  const number = Number(value || 0);
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(Number.isFinite(number) ? number : 0)}%`;
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatBytes(value?: unknown) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function label(map: Record<string, string>, value?: string | null) {
  const key = String(value || "").toLowerCase();
  return map[key] || value || "-";
}

export function entriesOf(record?: Record<string, unknown> | null) {
  return Object.entries(record || {}).filter(([, value]) => value !== undefined && value !== null);
}

export function isFinanceKey(key: string) {
  return /revenue|invoice|payment|receivable|outstanding|margin|cost|paid|amount|finance|unpaid/i.test(key);
}

export function getDefaultReportParams(): ReportParams {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  return {
    date_from: first,
    date_to: now.toISOString().slice(0, 10),
    group_by: "month",
  };
}

export function downloadText(filename: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function compactJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export function badgeTone(value?: string | null) {
  const key = String(value || "").toLowerCase();
  if (["urgent", "high", "blocked", "overdue", "exceeded", "rejected"].includes(key)) return "border-destructive/30 bg-destructive/10 text-destructive";
  if (["medium", "pending", "sent", "on_track"].includes(key)) return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (["accepted", "approved", "paid", "completed", "active"].includes(key)) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  return "border-border bg-muted/40 text-muted-foreground";
}

