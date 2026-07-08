"use client";

import {
  CrmResourcePage,
  type CrmColumn,
  type CrmField,
} from "@/components/tenant-crm/crm-core";

const DECISION_LEVELS = [
  { value: "owner", label: "Owner/CEO" },
  { value: "marketing", label: "Marketing" },
  { value: "technical", label: "Tecnico" },
  { value: "administration", label: "Amministrazione" },
  { value: "other", label: "Altro" },
];

const fields: CrmField[] = [
  { key: "company_id", label: "Azienda", type: "relation", relation: "companies" },
  { key: "first_name", label: "Nome", required: true },
  { key: "last_name", label: "Cognome" },
  { key: "role_title", label: "Ruolo" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Telefono" },
  { key: "decision_level", label: "Area decisionale", type: "select", options: DECISION_LEVELS },
  { key: "preferred_channel", label: "Canale preferito" },
  { key: "notes", label: "Note", type: "textarea" },
];

const columns: CrmColumn[] = [
  { key: "first_name", label: "Nome", format: (_value, row) => [row.first_name, row.last_name].filter(Boolean).join(" ") || "-" },
  { key: "company_name", label: "Azienda" },
  { key: "role_title", label: "Ruolo" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefono" },
];

export default function ContactsPage() {
  return (
    <CrmResourcePage
      title="Contatti"
      description="Referenti reali collegati alle aziende del tenant."
      resource="contacts"
      createLabel="Nuovo contatto"
      fields={fields}
      columns={columns}
      filterKey="decision_level"
      filterOptions={DECISION_LEVELS}
      emptyText="Nessun contatto reale ancora presente."
    />
  );
}
