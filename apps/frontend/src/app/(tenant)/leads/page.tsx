"use client";

import {
  CrmResourcePage,
  LEAD_STATUS_OPTIONS,
  StatusBadge,
  type CrmRow,
  money,
  shortDate,
  type CrmColumn,
  type CrmField,
} from "@/components/tenant-crm/crm-core";
import { Badge } from "@/components/ui/badge";

const QUALITY_OPTIONS = [
  { value: "low", label: "Bassa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];

const fields: CrmField[] = [
  { key: "company_id", label: "Azienda", type: "relation", relation: "companies" },
  { key: "contact_id", label: "Contatto", type: "relation", relation: "contacts" },
  { key: "title", label: "Titolo lead", required: true },
  { key: "source", label: "Fonte" },
  { key: "interest", label: "Interesse" },
  { key: "budget_estimate", label: "Budget stimato", type: "number" },
  { key: "urgency", label: "Urgenza" },
  { key: "quality", label: "Qualita", type: "select", options: QUALITY_OPTIONS },
  { key: "status", label: "Stato", type: "select", options: LEAD_STATUS_OPTIONS },
  { key: "next_action", label: "Prossima azione" },
  { key: "next_action_at", label: "Quando", type: "datetime-local" },
  { key: "lost_reason", label: "Motivo perso" },
  { key: "notes", label: "Note", type: "textarea" },
];

const columns: CrmColumn[] = [
  { key: "title", label: "Lead" },
  { key: "company_name", label: "Azienda" },
  { key: "source", label: "Fonte", format: (value) => sourceBadge(value) },
  { key: "interest", label: "Interesse", format: (value) => compactText(value) },
  { key: "urgency", label: "Urgenza", format: (value) => compactText(value) },
  { key: "status", label: "Stato", format: (value) => <StatusBadge value={String(value || "")} options={LEAD_STATUS_OPTIONS} /> },
  { key: "budget_estimate", label: "Budget", format: (value) => money(value), sensitive: true },
  { key: "created_at", label: "Creato", format: (value) => shortDate(value) },
  { key: "next_action_at", label: "Prossima azione", format: (value) => shortDate(value) },
];

function sourceBadge(value: unknown) {
  return value === "website_form"
    ? <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">Sito web</Badge>
    : <span className="text-muted-foreground">{String(value || "-")}</span>;
}

function compactText(value: unknown, _row?: CrmRow) {
  const text = String(value || "-");
  return <span className="line-clamp-2 max-w-[220px] text-sm">{text}</span>;
}

export default function LeadsPage() {
  return (
    <CrmResourcePage
      title="Lead"
      description="Lead commerciali persistenti, senza dati demo."
      resource="leads"
      createLabel="Nuovo lead"
      fields={fields}
      columns={columns}
      filterKey="status"
      filterOptions={LEAD_STATUS_OPTIONS}
      emptyText="Nessun lead reale ancora presente."
    />
  );
}
