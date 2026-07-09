"use client";

import { getDoFlowUser } from "@/lib/jwt";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };

export const CONTRACT_STATUSES: Option[] = [
  { value: "draft", label: "Bozza" },
  { value: "preparing", label: "In preparazione" },
  { value: "sent", label: "Inviato" },
  { value: "in_review", label: "In revisione" },
  { value: "approved", label: "Approvato" },
  { value: "signed", label: "Firmato" },
  { value: "active", label: "Attivo" },
  { value: "expired", label: "Scaduto" },
  { value: "cancelled", label: "Annullato" },
  { value: "archived", label: "Archiviato" },
];

export const SIGNATURE_STATUSES: Option[] = [
  { value: "not_started", label: "Non avviata" },
  { value: "internal_pending", label: "In attesa interna" },
  { value: "client_pending", label: "In attesa cliente" },
  { value: "partially_signed", label: "Parzialmente firmato" },
  { value: "completed", label: "Completata" },
  { value: "declined", label: "Rifiutata" },
  { value: "not_required", label: "Non richiesta" },
];

export const CONTRACT_TYPES: Option[] = [
  { value: "website", label: "Sito web" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "maintenance", label: "Manutenzione" },
  { value: "consulting", label: "Consulenza" },
  { value: "nda", label: "NDA" },
  { value: "privacy", label: "Privacy" },
  { value: "generic", label: "Generico" },
];

export const PRIORITIES: Option[] = [
  { value: "low", label: "Bassa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export const CHECKLIST_STATUSES: Option[] = [
  { value: "missing", label: "Mancante" },
  { value: "requested", label: "Richiesto" },
  { value: "received", label: "Ricevuto" },
  { value: "in_review", label: "In revisione" },
  { value: "approved", label: "Approvato" },
  { value: "rejected", label: "Rifiutato" },
  { value: "not_applicable", label: "Non applicabile" },
];

export const CHECKLIST_CATEGORIES: Option[] = [
  { value: "document", label: "Documento" },
  { value: "approval", label: "Approvazione" },
  { value: "legal", label: "Legale" },
  { value: "finance", label: "Finance" },
  { value: "technical", label: "Tecnico" },
  { value: "content", label: "Contenuti" },
  { value: "access", label: "Accessi" },
  { value: "other", label: "Altro" },
];

export const SIGNER_TYPES: Option[] = [
  { value: "internal", label: "Interno" },
  { value: "client", label: "Cliente" },
  { value: "other", label: "Altro" },
];

export const SIGNER_STATUSES: Option[] = [
  { value: "pending", label: "In attesa" },
  { value: "viewed", label: "Visto" },
  { value: "signed", label: "Firmato" },
  { value: "declined", label: "Rifiutato" },
  { value: "not_required", label: "Non richiesto" },
];

export const VERSION_STATUSES: Option[] = [
  { value: "draft", label: "Bozza" },
  { value: "review", label: "Review" },
  { value: "final", label: "Finale" },
  { value: "signed_snapshot", label: "Snapshot firmato" },
  { value: "archived", label: "Archiviato" },
];

export function labelFor(value: string | undefined | null, options: Option[]) {
  return options.find((option) => option.value === value)?.label || String(value || "-").replace(/_/g, " ");
}

export function canViewFinanceValues() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "superadmin", "super_admin"].includes(role);
}

export function canManageAdminWorkflow() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "superadmin", "super_admin", "manager"].includes(role);
}

export function canAdminTemplates() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "superadmin", "super_admin"].includes(role);
}

export function badgeClass(value?: string | null) {
  const v = String(value || "");
  return cn(
    ["signed", "active", "approved", "completed", "received"].includes(v) && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
    ["urgent", "overdue", "expired", "cancelled", "rejected", "declined", "blocked"].includes(v) && "border-destructive/30 bg-destructive/10 text-destructive",
    ["sent", "in_review", "client_pending", "internal_pending", "partially_signed", "waiting", "in_progress", "requested"].includes(v) && "border-amber-500/30 bg-amber-500/10 text-amber-600",
    (!v || ["draft", "not_started", "medium", "open", "missing"].includes(v)) && "border-border bg-muted text-muted-foreground",
  );
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function money(value?: number | string | null, currency = "EUR") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("it-IT", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

export function toBody(form: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(form).filter(([, value]) => value !== "" && value !== undefined && value !== "__none__"));
}

export function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
