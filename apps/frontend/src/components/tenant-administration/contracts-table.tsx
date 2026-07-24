"use client";

import { ChevronRight, FileSignature } from "lucide-react";
import {
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  SIGNATURE_STATUSES,
  administrationDate,
  financeMoney,
  optionLabel,
  relationName,
  type AdministrationRow,
} from "./administration-model";
import { AdministrationBadge, AdministrationEmpty } from "./administration-ui";

export function ContractsTable({
  rows,
  companies,
  selectedId,
  canViewFinance,
  onSelect,
}: {
  rows: AdministrationRow[];
  companies: AdministrationRow[];
  selectedId?: string;
  canViewFinance: boolean;
  onSelect: (row: AdministrationRow) => void;
}) {
  if (rows.length === 0) return <AdministrationEmpty>Nessun contratto corrisponde ai filtri selezionati.</AdministrationEmpty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-[13px]">
        <thead><tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
          {["Contratto", "Cliente", "Tipologia", ...(canViewFinance ? ["Valore"] : []), "Decorrenza", "Scadenza", "Stato", "Firma", ""].map((label, index) => <th key={`${label}-${index}`} className="px-4 py-3">{label}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={selectedId === row.id ? "border-b border-indigo-100 bg-indigo-50/60" : "border-b border-slate-100 hover:bg-slate-50/60"} onClick={() => onSelect(row)}>
              <td className="px-4 py-4"><button className="text-left font-semibold text-slate-950 hover:text-indigo-600">{row.contract_number || row.title}</button><p className="mt-1 max-w-[180px] truncate text-xs text-slate-500">{row.title}</p></td>
              <td className="px-4 py-4 text-slate-700">{relationName(row.company_id, companies) || (row.company_id ? "Cliente collegato" : "Non associato")}</td>
              <td className="px-4 py-4 text-slate-700">{optionLabel(CONTRACT_TYPES, row.contract_type)}</td>
              {canViewFinance ? <td className="px-4 py-4 font-semibold tabular-nums text-slate-950">{row.amount == null ? "—" : financeMoney(row.amount, row.currency)}</td> : null}
              <td className="px-4 py-4 text-slate-600">{administrationDate(row.start_date)}</td>
              <td className="px-4 py-4 text-slate-600">{administrationDate(row.end_date || row.due_date)}</td>
              <td className="px-4 py-4"><AdministrationBadge value={row.status} label={optionLabel(CONTRACT_STATUSES, row.status)} /></td>
              <td className="px-4 py-4"><span className="inline-flex items-center gap-2 text-slate-600"><FileSignature className="h-4 w-4 text-indigo-500" />{optionLabel(SIGNATURE_STATUSES, row.signature_status)}</span></td>
              <td className="px-4 py-4"><ChevronRight className="h-4 w-4 text-slate-400" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
