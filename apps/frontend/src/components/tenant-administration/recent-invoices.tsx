"use client";

import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import {
  INVOICE_STATUSES,
  administrationDate,
  financeMoney,
  optionLabel,
  type AdministrationRow,
} from "./administration-model";
import { AdministrationBadge, AdministrationEmpty, AdministrationPanel } from "./administration-ui";

export function RecentInvoices({ rows }: { rows: AdministrationRow[] }) {
  return (
    <AdministrationPanel title="Fatture recenti" actionHref="/finance/invoices" actionLabel="Vedi tutte">
      {rows.length === 0 ? <AdministrationEmpty>Nessuna fattura recente.</AdministrationEmpty> : (
        <div className="divide-y divide-slate-100">
          {rows.slice(0, 5).map((row) => (
            <div key={row.id} className="grid items-center gap-3 py-3 text-sm sm:grid-cols-[minmax(0,1.4fr)_minmax(110px,1fr)_100px_110px_24px]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><FileText className="h-4 w-4" /></span>
                <div className="min-w-0"><p className="truncate font-medium text-slate-900">{row.company_name || row.project_name || row.title}</p><p className="truncate text-xs text-slate-500">{row.invoice_number || row.title}</p></div>
              </div>
              <span className="text-slate-500">{administrationDate(row.due_date, false)}</span>
              <span className="font-semibold text-slate-900">{financeMoney(row.total, row.currency)}</span>
              <AdministrationBadge value={row.status} label={optionLabel(INVOICE_STATUSES, row.status)} />
              <Link href="/finance/invoices" className="text-slate-400 hover:text-indigo-600"><ChevronRight className="h-4 w-4" /></Link>
            </div>
          ))}
        </div>
      )}
    </AdministrationPanel>
  );
}
