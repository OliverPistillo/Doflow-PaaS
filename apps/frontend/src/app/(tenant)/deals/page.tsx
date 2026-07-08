"use client";

import {
  CrmResourcePage,
  OPPORTUNITY_STAGE_OPTIONS,
  StatusBadge,
  money,
  shortDate,
  type CrmColumn,
  type CrmField,
} from "@/components/tenant-crm/crm-core";

const fields: CrmField[] = [
  { key: "company_id", label: "Azienda", type: "relation", relation: "companies" },
  { key: "contact_id", label: "Contatto", type: "relation", relation: "contacts" },
  { key: "lead_id", label: "Lead origine", type: "relation", relation: "leads" },
  { key: "title", label: "Titolo opportunita", required: true },
  { key: "service_type", label: "Tipo servizio" },
  { key: "value_estimate", label: "Valore stimato", type: "number" },
  { key: "probability", label: "Probabilita (%)", type: "number" },
  { key: "stage", label: "Stage", type: "select", options: OPPORTUNITY_STAGE_OPTIONS },
  { key: "expected_close_date", label: "Chiusura prevista", type: "date" },
  { key: "next_action", label: "Prossima azione" },
  { key: "next_action_at", label: "Quando", type: "datetime-local" },
  { key: "lost_reason", label: "Motivo perso" },
  { key: "notes", label: "Note", type: "textarea" },
];

const columns: CrmColumn[] = [
  { key: "title", label: "Opportunita" },
  { key: "company_name", label: "Azienda" },
  { key: "stage", label: "Stage", format: (value) => <StatusBadge value={String(value || "")} options={OPPORTUNITY_STAGE_OPTIONS} /> },
  { key: "value_estimate", label: "Valore", format: (value) => money(value), sensitive: true },
  { key: "expected_close_date", label: "Chiusura", format: (value) => shortDate(value) },
];

export default function DealsPage() {
  return (
    <CrmResourcePage
      title="Opportunita"
      description="Pipeline commerciale reale del tenant doflow."
      resource="opportunities"
      createLabel="Nuova opportunita"
      fields={fields}
      columns={columns}
      filterKey="stage"
      filterOptions={OPPORTUNITY_STAGE_OPTIONS}
      emptyText="Nessuna opportunita reale ancora presente."
    />
  );
}
