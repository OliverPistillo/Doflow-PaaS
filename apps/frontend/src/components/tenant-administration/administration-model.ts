export type AdministrationRow = Record<string, any>;

export type AdministrationList<T = AdministrationRow> = {
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
};

export const INVOICE_STATUSES = [
  ["draft", "Bozza"],
  ["issued", "Emessa"],
  ["sent", "Inviata"],
  ["partially_paid", "Parzialmente pagata"],
  ["paid", "Pagata"],
  ["overdue", "Scaduta"],
  ["cancelled", "Annullata"],
  ["void", "Annullata"],
] as const;

export const RENEWAL_STATUSES = [
  ["upcoming", "In arrivo"],
  ["reminded", "Promemoria inviato"],
  ["invoiced", "Fatturato"],
  ["paid", "Rinnovato"],
  ["cancelled", "Annullato"],
  ["expired", "Scaduto"],
] as const;

export const BILLING_CYCLES = [
  ["monthly", "Mensile"],
  ["quarterly", "Trimestrale"],
  ["yearly", "Annuale"],
  ["one_time", "Una tantum"],
] as const;

export const CONTRACT_STATUSES = [
  ["draft", "Bozza"],
  ["preparing", "In preparazione"],
  ["sent", "Inviato"],
  ["in_review", "In revisione"],
  ["approved", "Approvato"],
  ["signed", "Firmato"],
  ["active", "Attivo"],
  ["expired", "Terminato"],
  ["cancelled", "Annullato"],
  ["archived", "Archiviato"],
] as const;

export const CONTRACT_TYPES = [
  ["website", "Sito web"],
  ["ecommerce", "E-commerce"],
  ["maintenance", "Manutenzione"],
  ["consulting", "Consulenza"],
  ["nda", "NDA"],
  ["privacy", "Privacy"],
  ["generic", "Generico"],
] as const;

export const SIGNATURE_STATUSES = [
  ["not_started", "Non avviata"],
  ["internal_pending", "In attesa interna"],
  ["client_pending", "In attesa cliente"],
  ["partially_signed", "Parzialmente firmato"],
  ["completed", "Completata"],
  ["declined", "Rifiutata"],
  ["not_required", "Non richiesta"],
] as const;

export type AdministrationOptions = ReadonlyArray<readonly [string, string]>;

export function optionLabel(options: AdministrationOptions, value?: string | null) {
  return options.find(([key]) => key === value)?.[1] || String(value || "Non definito").replace(/_/g, " ");
}

export function financeMoney(value?: number | string | null, currency = "EUR") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function administrationDate(value?: string | null, withYear = true) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(date);
}

export function dateValue(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function numeric(value?: number | string | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function relationName(
  id: string | null | undefined,
  rows: AdministrationRow[],
  fields: string[] = ["name", "title"],
) {
  if (!id) return "";
  const row = rows.find((item) => item.id === id);
  return fields.map((field) => row?.[field]).find(Boolean) || "";
}

export function daysUntil(value?: string | null) {
  const date = dateValue(value);
  if (!date) return null;
  return Math.ceil((startOfDay(date).getTime() - startOfDay().getTime()) / 86_400_000);
}

export function statusTone(value?: string | null): "slate" | "violet" | "blue" | "green" | "orange" | "red" {
  const status = String(value || "");
  if (["paid", "active", "signed", "completed", "approved", "confirmed"].includes(status)) return "green";
  if (["overdue", "expired", "declined", "cancelled", "void", "failed"].includes(status)) return "red";
  if (["partially_paid", "client_pending", "internal_pending", "reminded", "in_review"].includes(status)) return "orange";
  if (["issued", "sent", "invoiced"].includes(status)) return "blue";
  if (["upcoming", "partially_signed"].includes(status)) return "violet";
  return "slate";
}
