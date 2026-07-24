"use client";

import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  task_due: "Task in scadenza",
  task_due_today: "Task in scadenza oggi",
  task_overdue: "Task scaduto",
  task_assigned: "Task assegnato",
  milestone_due: "Milestone in scadenza",
  milestone_due_soon: "Milestone in arrivo",
  milestone_overdue: "Milestone scaduta",
  project_blocked: "Progetto bloccato",
  project_due: "Progetto in scadenza",
  project_due_soon: "Progetto in scadenza",
  quote_follow_up: "Follow-up preventivo",
  quote_sent_follow_up_7_days: "Follow-up preventivo",
  quote_draft_stale_14_days: "Bozza preventivo ferma",
  briefing_incomplete: "Briefing incompleto",
  briefing_incomplete_3_days: "Briefing incompleto",
  invoice_overdue: "Fattura scaduta",
  invoice_due: "Fattura in scadenza",
  invoice_due_soon: "Fattura in scadenza",
  payment_received: "Pagamento ricevuto",
  renewal_due: "Rinnovo in scadenza",
  renewal_due_30_days: "Rinnovo in scadenza",
  recurring_due: "Ricorrenza in scadenza",
  recurring_service_due_30_days: "Servizio ricorrente in scadenza",
  financial_deadline_due: "Scadenza finance",
  financial_deadline_due_soon: "Scadenza finance",
  system: "Sistema",
};

const ENTITY_LABELS: Record<string, string> = {
  company: "Azienda",
  contact: "Contatto",
  lead: "Lead",
  opportunity: "Opportunità",
  briefing: "Briefing",
  quote: "Preventivo",
  project: "Progetto",
  task: "Task",
  milestone: "Milestone",
  invoice: "Fattura",
  payment: "Pagamento",
  deadline: "Scadenza",
  renewal: "Rinnovo",
  recurring_service: "Servizio ricorrente",
};

const CATEGORY_LABELS: Record<string, string> = {
  crm: "CRM",
  quotes: "Preventivi",
  briefing: "Briefing",
  projects: "Progetti",
  finance: "Finance",
  renewals: "Rinnovi",
  system: "Sistema",
};

export function typeLabel(type?: string | null): string {
  const key = String(type || "").trim();
  return TYPE_LABELS[key] || key.replace(/_/g, " ") || "Notifica";
}

export function entityLabel(type?: string | null): string {
  const key = String(type || "").trim();
  return ENTITY_LABELS[key] || key.replace(/_/g, " ");
}

export function categoryLabel(category?: string | null): string {
  const key = String(category || "").trim();
  return CATEGORY_LABELS[key] || key.replace(/_/g, " ") || "Sistema";
}

export function priorityLabel(priority?: string | null): string {
  const value = String(priority || "medium").trim();
  if (value === "urgent") return "Urgente";
  if (value === "high") return "Alta";
  if (value === "low") return "Bassa";
  return "Media";
}

export function statusLabel(status?: string | null): string {
  const value = String(status || "").trim();
  if (value === "unread") return "Non letta";
  if (value === "read") return "Letta";
  if (value === "archived") return "Archiviata";
  if (value === "enabled") return "Attiva";
  if (value === "disabled") return "Disattiva";
  if (value === "generated") return "Generato";
  return value.replace(/_/g, " ") || "Stato";
}

export function priorityClass(priority?: string | null): string {
  const value = String(priority || "medium");
  return cn(
    value === "urgent" && "border-destructive/40 bg-destructive/10 text-destructive",
    value === "high" && "border-chart-5/40 bg-chart-5/10 text-chart-5",
    value === "medium" && "border-primary/30 bg-primary/10 text-primary",
    value === "low" && "border-border bg-muted text-muted-foreground",
  );
}

export function statusClass(status?: string | null): string {
  const value = String(status || "");
  return cn(
    value === "unread" && "border-primary/40 bg-primary/10 text-primary",
    value === "read" && "border-border bg-muted text-muted-foreground",
    value === "archived" && "border-border bg-background text-muted-foreground",
    value === "generated" && "border-primary/30 bg-primary/10 text-primary",
  );
}

export function formatDateTime(value?: string | null): string {
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

export function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function isSafeInternalUrl(url?: string | null): url is string {
  return Boolean(url && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/client"));
}
