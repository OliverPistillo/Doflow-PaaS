"use client";

import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BILLING_CYCLES,
  RENEWAL_STATUSES,
  administrationDate,
  financeMoney,
  optionLabel,
  relationName,
  type AdministrationRow,
} from "./administration-model";
import { AdministrationBadge, AdministrationEmpty } from "./administration-ui";

export function RenewalsTable({
  rows,
  services,
  companies,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: {
  rows: AdministrationRow[];
  services: AdministrationRow[];
  companies: AdministrationRow[];
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (row: AdministrationRow) => void;
  onDelete: (row: AdministrationRow) => void;
}) {
  if (rows.length === 0) return <AdministrationEmpty>Nessun rinnovo corrisponde ai filtri selezionati.</AdministrationEmpty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-[13px]">
        <thead><tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
          {["Cliente", "Servizio", "Periodicità", "Prossimo rinnovo", "Importo", "Stato", "Azioni"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((row) => {
            const service = services.find((item) => item.id === row.recurring_service_id);
            const client = relationName(row.company_id || service?.company_id, companies);
            return (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-4 font-medium text-slate-900">{client || (row.company_id || service?.company_id ? "Cliente collegato" : "Non associato")}</td>
                <td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><RefreshCw className="h-4 w-4" /></span><div><p className="font-medium text-slate-900">{service?.name || row.title}</p>{service?.category ? <p className="text-xs text-slate-500">{service.category}</p> : null}</div></div></td>
                <td className="px-4 py-4 text-slate-600">{service?.billing_cycle ? optionLabel(BILLING_CYCLES, service.billing_cycle) : "Non indicata"}</td>
                <td className="px-4 py-4 font-medium text-indigo-700">{administrationDate(row.due_date)}</td>
                <td className="px-4 py-4 font-semibold tabular-nums text-slate-950">{row.amount == null ? "—" : financeMoney(row.amount, row.currency)}</td>
                <td className="px-4 py-4"><AdministrationBadge value={row.status} label={optionLabel(RENEWAL_STATUSES, row.status)} /></td>
                <td className="px-4 py-4"><div className="flex gap-1">{canUpdate ? <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(row)}><Pencil className="h-4 w-4" /></Button> : null}{canDelete ? <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => onDelete(row)}><Trash2 className="h-4 w-4" /></Button> : null}</div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
