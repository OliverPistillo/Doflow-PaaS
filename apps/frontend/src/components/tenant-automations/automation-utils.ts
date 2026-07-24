"use client";

import { getDoFlowUser } from "@/lib/jwt";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };

export const CATEGORY_LABELS: Record<string, string> = {
  crm: "CRM",
  sales: "Vendite",
  quotes: "Preventivi",
  projects: "Progetti",
  finance: "Finance",
  team: "Team",
  documents: "Documenti",
  contracts: "Contratti",
  paperwork: "Scartoffie",
  operations: "Operatività",
  general: "Generale",
};

export const RUN_STATUS_LABELS: Record<string, string> = {
  running: "In esecuzione",
  success: "Successo",
  partial_success: "Parziale",
  failed: "Fallita",
  skipped: "Saltata",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const RUN_MODE_LABELS: Record<string, string> = {
  manual: "Manuale",
  scheduled: "Programmata",
  event: "Evento",
  hybrid: "Ibrida",
};

export const TRIGGER_LABELS: Record<string, string> = {
  manual_run: "Run manuale",
  scheduled_daily: "Schedulata giornaliera",
  scheduled_hourly: "Schedulata oraria",
  scheduled_weekly: "Schedulata settimanale",
  lead_stale: "Lead fermo",
  opportunity_stale: "Opportunità ferma",
  commercial_activity_due: "Attività commerciale in scadenza",
  quote_sent_followup: "Follow-up preventivo",
  quote_accepted: "Preventivo accettato",
  quote_rejected: "Preventivo rifiutato",
  project_due_soon: "Progetto in scadenza",
  project_overdue: "Progetto in ritardo",
  project_blocked: "Progetto bloccato",
  task_due_today: "Task oggi",
  task_overdue: "Task scaduto",
  milestone_due_soon: "Milestone in scadenza",
  milestone_overdue: "Milestone scaduta",
  invoice_due_soon: "Fattura in scadenza",
  invoice_overdue: "Fattura scaduta",
  financial_deadline_due_soon: "Scadenza finance",
  renewal_due_soon: "Rinnovo in scadenza",
  recurring_service_due_soon: "Servizio ricorrente in scadenza",
  time_entry_submitted: "Time entry inviata",
  member_overloaded: "Membro sovraccarico",
  availability_starts_today: "Disponibilità oggi",
  contract_due_soon: "Contratto in scadenza",
  contract_overdue: "Contratto scaduto",
  contract_waiting_signature: "Contratto in attesa firma",
  contract_expiring_30_days: "Contratto in rinnovo",
  paperwork_due_soon: "Dossier in scadenza",
  paperwork_overdue: "Dossier scaduto",
  paperwork_blocked: "Dossier bloccato",
  paperwork_missing_required_items: "Scartoffie obbligatorie mancanti",
  document_uploaded: "Documento caricato",
  document_missing_for_entity: "Documento mancante",
  daily_digest: "Digest giornaliero",
  executive_risk_detected: "Rischio direzionale",
};

export function canViewFinanceAutomations(role = getDoFlowUser()?.role) {
  return ["owner", "admin", "superadmin", "super_admin"].includes(String(role || "").toLowerCase().trim());
}

export function canManageAutomations(role = getDoFlowUser()?.role) {
  return canViewFinanceAutomations(role);
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
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatMs(value?: number | null) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 ms";
  if (n < 1000) return `${n} ms`;
  return `${(n / 1000).toFixed(1)} s`;
}

export function badgeClass(value?: string | null) {
  const key = String(value || "").toLowerCase();
  return cn(
    ["failed", "urgent", "overdue", "error"].includes(key) && "border-destructive/30 bg-destructive/10 text-destructive",
    ["partial_success", "high", "medium", "running", "scheduled"].includes(key) && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    ["success", "enabled", "active", "low"].includes(key) && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    ["skipped", "manual", "event", "hybrid"].includes(key) && "border-border bg-muted/40 text-muted-foreground",
  );
}

export function compactJson(value: unknown, fallback = "{}") {
  try {
    return JSON.stringify(value ?? JSON.parse(fallback), null, 2);
  } catch {
    return fallback;
  }
}

export function parseJsonTextarea(value: string, fallback: unknown) {
  const text = value.trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON non valido. Controlla virgole, parentesi e virgolette.");
  }
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value ?? {}, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function isFinanceAutomation(row?: { category?: string | null; trigger_type?: string | null; actions?: unknown[] | null }) {
  const category = String(row?.category || "").toLowerCase();
  const trigger = String(row?.trigger_type || "").toLowerCase();
  const actions = Array.isArray(row?.actions) ? row?.actions : [];
  return category === "finance"
    || /invoice|payment|renewal|recurring|financial/.test(trigger)
    || actions.some((item) => /financial|finance|invoice|payment|amount/i.test(JSON.stringify(item)));
}

export function scrubFinancePayload(value: unknown, canFinance: boolean): unknown {
  if (canFinance) return value;
  if (Array.isArray(value)) return value.map((item) => scrubFinancePayload(item, canFinance));
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    if (/amount|paid|total|invoice|payment|finance|margin|cost|revenue|outstanding/i.test(key)) {
      result[key] = "[riservato]";
    } else {
      result[key] = scrubFinancePayload(nested, canFinance);
    }
  });
  return result;
}
