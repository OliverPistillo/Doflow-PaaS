"use client";

import { getDoFlowUser } from "@/lib/jwt";

export const EVENT_TYPE_LABELS: Record<string, string> = {
  internal: "Interno",
  meeting: "Meeting",
  call: "Call",
  focus_time: "Focus time",
  unavailable: "Non disponibile",
  task_due: "Scadenza task",
  milestone_due: "Scadenza milestone",
  project_deadline: "Deadline progetto",
  commercial_activity_due: "Attività commerciale",
  quote_followup: "Follow-up preventivo",
  invoice_due: "Scadenza fattura",
  financial_deadline: "Scadenza finanziaria",
  renewal_due: "Rinnovo",
  recurring_service_due: "Servizio ricorrente",
  contract_due: "Scadenza contratto",
  contract_signature: "Firma contratto",
  contract_expiration: "Scadenza validità contratto",
  paperwork_due: "Scadenza dossier",
  paperwork_item_due: "Scadenza documento",
  briefing_due: "Scadenza briefing",
  document_reminder: "Promemoria documento",
  reminder: "Promemoria",
};

export const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programmato",
  tentative: "Provvisorio",
  completed: "Completato",
  cancelled: "Annullato",
  skipped: "Saltato",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const VISIBILITY_LABELS: Record<string, string> = {
  private: "Privato",
  team: "Team",
  admin: "Admin",
};

export const TRANSPARENCY_LABELS: Record<string, string> = {
  busy: "Occupato",
  free: "Libero",
};

export const LINK_ENTITY_TYPES = [
  "project",
  "task",
  "milestone",
  "quote",
  "invoice",
  "financial_deadline",
  "renewal",
  "contract",
  "paperwork_dossier",
  "paperwork_item",
  "document",
  "contact",
  "company",
  "opportunity",
  "lead",
  "commercial_activity",
] as const;

export const FINANCE_EVENT_TYPES = new Set(["invoice_due", "financial_deadline", "renewal_due", "recurring_service_due"]);

export function canViewCalendarFinance(role = getDoFlowUser()?.role) {
  return ["owner", "admin", "superadmin", "super_admin"].includes(String(role || "").toLowerCase().trim());
}

export function canManageCalendar(role = getDoFlowUser()?.role) {
  return ["owner", "admin", "superadmin", "super_admin", "manager"].includes(String(role || "").toLowerCase().trim());
}

export function label(map: Record<string, string>, value?: string | null) {
  return map[String(value || "").toLowerCase()] || String(value || "-").replace(/_/g, " ");
}

export function optionList(values?: string[], labels: Record<string, string> = {}) {
  return (values || []).map((value) => ({ value, label: labels[value] || value.replace(/_/g, " ") }));
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "2-digit", month: "short" }).format(date);
}

export function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function fromDateTimeInput(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function formatMinutesAsHours(value?: unknown) {
  const minutes = Number(value || 0);
  if (!Number.isFinite(minutes)) return "0h";
  const hours = minutes / 60;
  return `${hours.toLocaleString("it-IT", { maximumFractionDigits: 1 })}h`;
}

export function compactJson(value: unknown) {
  if (value === undefined || value === null || value === "") return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function parseJsonTextarea(value: string, fallback: unknown = {}) {
  const text = value.trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON non valido");
  }
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function badgeClass(value?: string | null) {
  const key = String(value || "").toLowerCase();
  if (["urgent", "cancelled", "failed"].includes(key)) return "border-destructive/40 bg-destructive/10 text-destructive";
  if (["high", "tentative", "pending", "scheduled"].includes(key)) return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (["completed", "sent", "accepted"].includes(key)) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["medium", "team"].includes(key)) return "border-primary/30 bg-primary/10 text-primary";
  return "border-border bg-muted/40 text-muted-foreground";
}

export function isFinanceEvent(value?: { event_type?: string | null; source_entity_type?: string | null; metadata?: unknown } | null) {
  return Boolean(value && (FINANCE_EVENT_TYPES.has(String(value.event_type || "")) || ["invoice", "payment", "financial_deadline", "renewal", "recurring_service"].includes(String(value.source_entity_type || ""))));
}

export function scrubFinancePayload(value: unknown, canFinance: boolean): unknown {
  if (canFinance || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => scrubFinancePayload(item, canFinance));
  if (typeof value !== "object") return value;
  const clean: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/amount|total|price|paid|remaining|invoice|payment|finance|revenue|margin|cost|rate/i.test(key)) {
      clean[key] = "[riservato]";
    } else {
      clean[key] = scrubFinancePayload(item, canFinance);
    }
  }
  return clean;
}
