"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, FileSignature } from "lucide-react";
import {
  RENEWAL_STATUSES,
  administrationDate,
  financeMoney,
  optionLabel,
  type AdministrationRow,
} from "./administration-model";
import { AdministrationBadge, AdministrationEmpty, AdministrationPanel } from "./administration-ui";

export function ContractsRenewalsSummary({
  renewals,
  contracts,
  canViewContracts,
}: {
  renewals: AdministrationRow[];
  contracts: AdministrationRow[];
  canViewContracts: boolean;
}) {
  const sourceEntries: AdministrationRow[] = [
    ...renewals.slice(0, 4).map((row) => ({ ...row, kind: "renewal" })),
    ...(canViewContracts ? contracts.slice(0, Math.max(0, 4 - renewals.length)).map((row) => ({ ...row, kind: "contract", due_date: row.renewal_date || row.end_date || row.due_date })) : []),
  ];
  const entries = sourceEntries
    .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")))
    .slice(0, 4);

  return (
    <AdministrationPanel title="Contratti e rinnovi" actionHref="/finance/renewals" actionLabel="Vedi rinnovi">
      {entries.length === 0 ? <AdministrationEmpty>Nessun rinnovo o contratto in scadenza.</AdministrationEmpty> : (
        <div className="divide-y divide-slate-100">
          {entries.map((row) => {
            const contract = row.kind === "contract";
            const href = contract ? `/contracts/${row.id}` : "/finance/renewals";
            return (
              <div key={`${row.kind}-${row.id}`} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  {contract ? <FileSignature className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{row.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{administrationDate(row.due_date)}</p>
                </div>
                {row.amount != null ? <span className="text-sm font-semibold">{financeMoney(row.amount, row.currency)}</span> : null}
                <AdministrationBadge
                  value={contract ? row.signature_status || row.status : row.status}
                  label={contract ? undefined : optionLabel(RENEWAL_STATUSES, row.status)}
                />
                <Link href={href} className="text-slate-400 hover:text-indigo-600"><ChevronRight className="h-4 w-4" /></Link>
              </div>
            );
          })}
        </div>
      )}
    </AdministrationPanel>
  );
}
