"use client";

import {
  COMPANY_STATUS_OPTIONS,
  CrmResourcePage,
  StatusBadge,
  type CrmColumn,
  type CrmField,
} from "@/components/tenant-crm/crm-core";

const fields: CrmField[] = [
  { key: "name", label: "Nome azienda", required: true },
  { key: "legal_name", label: "Ragione sociale" },
  { key: "vat_number", label: "Partita IVA" },
  { key: "fiscal_code", label: "Codice fiscale" },
  { key: "website", label: "Sito web" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Telefono" },
  { key: "industry", label: "Settore" },
  { key: "size", label: "Dimensione" },
  { key: "status", label: "Stato", type: "select", options: COMPANY_STATUS_OPTIONS },
  { key: "source", label: "Fonte" },
  { key: "city", label: "Citta" },
  { key: "province", label: "Provincia" },
  { key: "country", label: "Paese" },
  { key: "notes", label: "Note", type: "textarea" },
];

const columns: CrmColumn[] = [
  { key: "name", label: "Azienda" },
  { key: "status", label: "Stato", format: (value) => <StatusBadge value={String(value || "")} options={COMPANY_STATUS_OPTIONS} /> },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefono" },
  { key: "city", label: "Citta" },
];

export default function CompaniesPage() {
  return (
    <CrmResourcePage
      title="Aziende"
      description="Anagrafica aziende e clienti del tenant doflow."
      resource="companies"
      createLabel="Nuova azienda"
      fields={fields}
      columns={columns}
      filterKey="status"
      filterOptions={COMPANY_STATUS_OPTIONS}
      emptyText="Nessuna azienda reale ancora presente. Crea la prima azienda per iniziare."
    />
  );
}
