"use client";

import {
  ACTIVITY_TYPE_OPTIONS,
  CrmResourcePage,
  StatusBadge,
  shortDate,
  type CrmColumn,
  type CrmField,
} from "@/components/tenant-crm/crm-core";

const fields: CrmField[] = [
  { key: "company_id", label: "Azienda", type: "relation", relation: "companies" },
  { key: "contact_id", label: "Contatto", type: "relation", relation: "contacts" },
  { key: "lead_id", label: "Lead", type: "relation", relation: "leads" },
  { key: "opportunity_id", label: "Opportunita", type: "relation", relation: "opportunities" },
  { key: "type", label: "Tipo", type: "select", options: ACTIVITY_TYPE_OPTIONS, required: true },
  { key: "title", label: "Titolo", required: true },
  { key: "description", label: "Descrizione", type: "textarea" },
  { key: "due_at", label: "Scadenza", type: "datetime-local" },
];

const columns: CrmColumn[] = [
  { key: "title", label: "Attivita" },
  { key: "type", label: "Tipo", format: (value) => <StatusBadge value={String(value || "")} options={ACTIVITY_TYPE_OPTIONS} /> },
  { key: "company_name", label: "Azienda" },
  { key: "due_at", label: "Scadenza", format: (value) => shortDate(value) },
  { key: "completed_at", label: "Stato", format: (value) => value ? "Completata" : "Da fare" },
];

export default function ActivitiesPage() {
  return (
    <CrmResourcePage
      title="Attivita commerciali"
      description="Call, email, meeting e follow-up collegati al CRM."
      resource="activities"
      createLabel="Nuova attivita"
      fields={fields}
      columns={columns}
      filterKey="type"
      filterOptions={ACTIVITY_TYPE_OPTIONS}
      emptyText="Nessuna attivita commerciale ancora presente."
    />
  );
}
