"use client";

import { cn } from "@/lib/utils";

export const DOCUMENT_CATEGORIES = [
  "generic",
  "contract",
  "quote",
  "invoice",
  "receipt",
  "project_asset",
  "briefing_material",
  "company_document",
  "brand_asset",
  "legal",
  "finance",
  "technical",
  "image",
  "video",
  "archive",
] as const;

export const DOCUMENT_VISIBILITIES = ["internal", "finance", "private"] as const;
export const DOCUMENT_STATUSES = ["active", "archived", "deleted"] as const;
export const DOCUMENT_ENTITY_TYPES = [
  "company",
  "contact",
  "lead",
  "opportunity",
  "briefing",
  "quote",
  "project",
  "contract",
  "contract_version",
  "contract_checklist_item",
  "paperwork_dossier",
  "paperwork_item",
  "task",
  "milestone",
  "invoice",
  "payment",
  "deadline",
  "renewal",
  "recurring_service",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  generic: "Generico",
  contract: "Contratto",
  quote: "Preventivo",
  invoice: "Fattura",
  receipt: "Ricevuta",
  project_asset: "Asset progetto",
  briefing_material: "Materiale briefing",
  company_document: "Documento cliente",
  brand_asset: "Asset brand",
  legal: "Legale",
  finance: "Finance",
  technical: "Tecnico",
  image: "Immagine",
  video: "Video",
  archive: "Archivio",
};

const VISIBILITY_LABELS: Record<string, string> = {
  internal: "Interno",
  finance: "Finance",
  private: "Privato",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Attivo",
  archived: "Archiviato",
  deleted: "Eliminato",
};

const ENTITY_LABELS: Record<string, string> = {
  company: "Azienda",
  contact: "Contatto",
  lead: "Lead",
  opportunity: "Opportunità",
  briefing: "Briefing",
  quote: "Preventivo",
  project: "Progetto",
  contract: "Contratto",
  contract_version: "Versione contratto",
  contract_checklist_item: "Checklist contratto",
  paperwork_dossier: "Dossier amministrativo",
  paperwork_item: "Item scartoffie",
  task: "Task",
  milestone: "Milestone",
  invoice: "Fattura",
  payment: "Pagamento",
  deadline: "Scadenza",
  renewal: "Rinnovo",
  recurring_service: "Servizio ricorrente",
};

export function categoryLabel(value?: string | null) {
  return CATEGORY_LABELS[String(value || "")] || String(value || "generic").replace(/_/g, " ");
}

export function visibilityLabel(value?: string | null) {
  return VISIBILITY_LABELS[String(value || "")] || String(value || "internal");
}

export function statusLabel(value?: string | null) {
  return STATUS_LABELS[String(value || "")] || String(value || "active");
}

export function entityLabel(value?: string | null) {
  return ENTITY_LABELS[String(value || "")] || String(value || "").replace(/_/g, " ");
}

export function formatBytes(value?: number | string | null) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
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

export function categoryClass(value?: string | null) {
  const category = String(value || "generic");
  return cn(
    category === "finance" || category === "invoice" || category === "receipt"
      ? "border-chart-5/40 bg-chart-5/10 text-chart-5"
      : category === "contract" || category === "legal"
        ? "border-primary/30 bg-primary/10 text-primary"
        : category === "project_asset" || category === "brand_asset"
          ? "border-chart-2/40 bg-chart-2/10 text-chart-2"
          : "border-border bg-muted text-muted-foreground",
  );
}

export function visibilityClass(value?: string | null) {
  const visibility = String(value || "internal");
  return cn(
    visibility === "finance" && "border-chart-5/40 bg-chart-5/10 text-chart-5",
    visibility === "private" && "border-destructive/30 bg-destructive/10 text-destructive",
    visibility === "internal" && "border-primary/30 bg-primary/10 text-primary",
  );
}

export function statusClass(value?: string | null) {
  const status = String(value || "active");
  return cn(
    status === "active" && "border-primary/30 bg-primary/10 text-primary",
    status === "archived" && "border-border bg-muted text-muted-foreground",
    status === "deleted" && "border-destructive/30 bg-destructive/10 text-destructive",
  );
}

export function canViewFinanceDocuments(role?: string | null) {
  const normalized = String(role || "").toLowerCase();
  return ["owner", "admin", "superadmin", "super_admin"].includes(normalized);
}
