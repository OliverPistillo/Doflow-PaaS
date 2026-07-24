"use client";

import { Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INVOICE_STATUSES,
  administrationDate,
  financeMoney,
  numeric,
  optionLabel,
  type AdministrationRow,
} from "./administration-model";
import { AdministrationBadge, AdministrationEmpty } from "./administration-ui";

export function InvoicesTable({
  rows,
  selectedId,
  canUpdate,
  onSelect,
  onEdit,
}: {
  rows: AdministrationRow[];
  selectedId?: string;
  canUpdate: boolean;
  onSelect: (row: AdministrationRow) => void;
  onEdit: (row: AdministrationRow) => void;
}) {
  if (rows.length === 0) return <AdministrationEmpty>Nessuna fattura corrisponde ai filtri selezionati.</AdministrationEmpty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
            {["Fattura", "Cliente", "Data", "Scadenza", "Importo", "Incassato", "Stato", "Azioni"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const paidPercent = numeric(row.total) > 0 ? Math.min(100, Math.round((numeric(row.paid_total) / numeric(row.total)) * 100)) : 0;
            return (
              <tr
                key={row.id}
                className={selectedId === row.id ? "border-b border-indigo-100 bg-indigo-50/60" : "border-b border-slate-100 hover:bg-slate-50/60"}
                onClick={() => onSelect(row)}
              >
                <td className="px-4 py-4"><button className="text-left font-semibold text-slate-950 hover:text-indigo-600">{row.invoice_number || row.title}</button><p className="mt-1 max-w-[180px] truncate text-xs text-slate-500">{row.title}</p></td>
                <td className="px-4 py-4 text-slate-700">{row.company_name || row.project_name || "Non associato"}</td>
                <td className="px-4 py-4 text-slate-600">{administrationDate(row.issue_date, false)}</td>
                <td className="px-4 py-4 text-slate-600">{administrationDate(row.due_date, false)}</td>
                <td className="px-4 py-4 font-semibold tabular-nums text-slate-950">{financeMoney(row.total, row.currency)}</td>
                <td className="px-4 py-4">
                  <p className="font-medium tabular-nums text-slate-800">{financeMoney(row.paid_total, row.currency)}</p>
                  {numeric(row.total) > 0 ? <div className="mt-2 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPercent}%` }} /></div> : null}
                </td>
                <td className="px-4 py-4"><AdministrationBadge value={row.status} label={optionLabel(INVOICE_STATUSES, row.status)} /></td>
                <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onSelect(row)} aria-label="Apri riepilogo"><Eye className="h-4 w-4" /></Button>
                    {canUpdate ? <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(row)} aria-label="Modifica fattura"><Pencil className="h-4 w-4" /></Button> : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
