"use client";

import { BarChart3 } from "lucide-react";
import { financeMoney, type AdministrationRow } from "./administration-model";
import { AdministrationEmpty, AdministrationPanel } from "./administration-ui";

export function CashflowChart({ summary }: { summary?: AdministrationRow | null }) {
  return (
    <AdministrationPanel title="Andamento incassi" className="min-h-[330px]">
      <div className="flex h-[190px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60">
        <AdministrationEmpty className="min-h-0 border-0 bg-transparent">
          <span className="flex max-w-sm flex-col items-center gap-2">
            <BarChart3 className="h-6 w-6 text-indigo-500" />
            La serie storica mensile non è disponibile. Gli aggregati reali restano visibili qui sotto.
          </span>
        </AdministrationEmpty>
      </div>
      <div className="mt-4 grid grid-cols-1 divide-y divide-slate-200 border-t border-slate-100 pt-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <CashflowValue label="Fatturato" value={summary?.total_invoiced} tone="bg-indigo-500" />
        <CashflowValue label="Incassato" value={summary?.total_paid} tone="bg-emerald-500" />
        <CashflowValue label="Da incassare" value={summary?.total_outstanding} tone="bg-slate-400" />
      </div>
    </AdministrationPanel>
  );
}

function CashflowValue({ label, value, tone }: { label: string; value?: number | string | null; tone: string }) {
  return (
    <div className="px-3 py-3 first:pl-0 sm:py-0">
      <p className="flex items-center gap-2 text-xs text-slate-500"><span className={`h-2 w-2 rounded-full ${tone}`} />{label}</p>
      <p className="mt-1 pl-4 text-lg font-semibold text-slate-950">{financeMoney(value)}</p>
    </div>
  );
}
