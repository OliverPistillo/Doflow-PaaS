"use client";

import Link from "next/link";
import { CalendarDays, CheckSquare2, FileText, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { AdministrationBadge, AdministrationEmpty, AdministrationLoading } from "./administration-ui";

export function ContractDetailPanel({
  contract,
  companies,
  signers,
  checklist,
  documentCount,
  canViewFinance,
  loading,
  onClose,
}: {
  contract: AdministrationRow | null;
  companies: AdministrationRow[];
  signers: AdministrationRow[];
  checklist: AdministrationRow[];
  documentCount: number;
  canViewFinance: boolean;
  loading: boolean;
  onClose: () => void;
}) {
  if (!contract) return <aside className="rounded-2xl border border-slate-200/80 bg-white p-5"><h2 className="text-[17px] font-semibold text-slate-950">Dettaglio contratto</h2><AdministrationEmpty className="mt-4">Seleziona un contratto per consultarne stato e documentazione.</AdministrationEmpty></aside>;
  const signed = signers.filter((signer) => signer.status === "signed").length;
  const completed = checklist.filter((item) => ["approved", "not_applicable"].includes(item.status)).length;
  return (
    <aside className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="truncate text-lg font-semibold text-slate-950">{contract.title}</h2><p className="mt-1 text-sm text-slate-500">{contract.contract_number}</p></div>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      {loading ? <AdministrationLoading /> : (
        <>
          <div className="mt-5 space-y-0 divide-y divide-slate-100">
            <DetailRow label="Cliente" value={relationName(contract.company_id, companies) || (contract.company_id ? "Cliente collegato" : "Non associato")} />
            <DetailRow label="Tipologia" value={optionLabel(CONTRACT_TYPES, contract.contract_type)} />
            <DetailRow label="Stato" node={<AdministrationBadge value={contract.status} label={optionLabel(CONTRACT_STATUSES, contract.status)} />} />
            <DetailRow label="Firma" node={<AdministrationBadge value={contract.signature_status} label={optionLabel(SIGNATURE_STATUSES, contract.signature_status)} />} />
            {canViewFinance && contract.amount != null ? <DetailRow label="Valore" value={financeMoney(contract.amount, contract.currency)} /> : null}
            <DetailRow label="Decorrenza" value={administrationDate(contract.start_date)} icon={<CalendarDays className="h-4 w-4" />} />
            <DetailRow label="Scadenza" value={administrationDate(contract.end_date || contract.due_date)} icon={<CalendarDays className="h-4 w-4" />} />
          </div>
          <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
            <ProgressRow icon={<UsersRound className="h-4 w-4" />} label="Firmatari" value={signers.length ? `${signed}/${signers.length}` : "Nessuno"} percent={signers.length ? signed / signers.length * 100 : 0} />
            <ProgressRow icon={<CheckSquare2 className="h-4 w-4" />} label="Checklist" value={checklist.length ? `${completed}/${checklist.length}` : "Nessuna"} percent={checklist.length ? completed / checklist.length * 100 : 0} />
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-500"><FileText className="h-4 w-4" /> Documenti</span><span className="font-semibold text-slate-900">{documentCount}</span></div>
          </div>
        </>
      )}
      <Button asChild className="mt-5 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700"><Link href={`/contracts/${contract.id}`}>Apri contratto</Link></Button>
    </aside>
  );
}

function DetailRow({ label, value, node, icon }: { label: string; value?: string; node?: React.ReactNode; icon?: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 py-3 text-sm"><span className="flex items-center gap-2 text-slate-500">{icon}{label}</span>{node || <span className="text-right font-medium text-slate-900">{value}</span>}</div>;
}

function ProgressRow({ icon, label, value, percent }: { icon: React.ReactNode; label: string; value: string; percent: number }) {
  return <div><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-500">{icon}{label}</span><span className="font-semibold text-slate-900">{value}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div></div>;
}
