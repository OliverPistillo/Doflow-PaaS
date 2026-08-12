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
import { intakeAttributionLabel, intakeText, parseIntakeFormData } from "@/lib/public-lead-intake";

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
  { key: "contact_name", label: "Contatto", format: (value) => compactText(value) },
  { key: "company_name", label: "Azienda" },
  { key: "intake_form_data", label: "Richiesta", format: (value, row) => requestSummary(value, row) },
  { key: "source", label: "Fonte", format: (value, row) => sourceSummary(value, row) },
  { key: "status", label: "Stato", format: (value) => <StatusBadge value={String(value || "")} options={LEAD_STATUS_OPTIONS} /> },
  { key: "created_at", label: "Creato", format: (value) => shortDate(value) },
  { key: "next_action", label: "Prossima azione", format: (value, row) => nextAction(value, row) },
  { key: "budget_estimate", label: "Budget", format: (value) => money(value), sensitive: true },
];

function requestSummary(value: unknown, row: CrmRow) {
  const { projectType, goals, timeline, province } = parseIntakeFormData(value);

  if (row.source === "website_form" && (projectType || goals.length || timeline || province)) {
    return (
      <div className="min-w-[220px] space-y-1.5">
        {projectType ? <div className="font-medium text-foreground">{projectType}</div> : null}
        {goals.length ? (
          <div className="flex max-w-[300px] flex-wrap gap-1">
            {goals.map((goal) => <Badge key={goal} variant="secondary" className="font-normal">{goal}</Badge>)}
          </div>
        ) : null}
        {timeline || province ? (
          <div className="text-xs text-muted-foreground">{[timeline, province].filter(Boolean).join(" · ")}</div>
        ) : null}
      </div>
    );
  }

  const interest = intakeText(row.interest);
  const urgency = intakeText(row.urgency);
  return (
    <div className="max-w-[260px] space-y-1 text-sm">
      <div className="line-clamp-2">{interest || "-"}</div>
      {urgency ? <div className="text-xs text-muted-foreground">{urgency}</div> : null}
    </div>
  );
}

function sourceSummary(value: unknown, row: CrmRow) {
  if (value !== "website_form") {
    return <span className="text-muted-foreground">{intakeText(value) || "-"}</span>;
  }

  const detail = intakeAttributionLabel(row.intake_attribution);

  return (
    <div className="space-y-1">
      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">Sito web</Badge>
      {detail ? <div className="text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}

function compactText(value: unknown, _row?: CrmRow) {
  const text = intakeText(value) || "-";
  return <span className="line-clamp-2 max-w-[220px] text-sm">{text}</span>;
}

function nextAction(value: unknown, row: CrmRow) {
  const action = intakeText(value);
  const when = row.next_action_at ? shortDate(row.next_action_at) : null;
  return (
    <div className="max-w-[220px] space-y-1 text-sm">
      <div className="line-clamp-2">{action || "-"}</div>
      {when ? <div className="text-xs text-muted-foreground">{when}</div> : null}
    </div>
  );
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
