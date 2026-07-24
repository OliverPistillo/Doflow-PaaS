"use client";

import { CalendarClock, ExternalLink, FileText, Mail, Phone, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CommercialClientRow } from "./commercial-client-types";
import { commercialDate, commercialMoney, initials } from "./commercial-utils";

export function ClientDetailPanel({
  row,
  onClose,
  onOpen,
}: {
  row: CommercialClientRow;
  onClose: () => void;
  onOpen: () => void;
}) {
  const contactName = row.contact
    ? [row.contact.first_name, row.contact.last_name].filter(Boolean).join(" ")
    : null;

  return (
    <aside className="rounded-2xl border border-slate-200/80 bg-white p-5 xl:sticky xl:top-24 xl:self-start">
      <div className="flex items-start justify-between">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-xl font-semibold text-white">
          {initials(row.company.name)}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Chiudi dettaglio cliente">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <h2 className="mt-4 text-xl font-bold text-slate-950">{row.company.name}</h2>
      <span className="mt-2 inline-flex rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
        {row.company.status === "active_client" ? "Attivo" : row.company.status || "Non definito"}
      </span>

      {contactName ? (
        <div className="mt-7">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Referente</h3>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-800"><UserRound className="h-4 w-4" />{contactName}</p>
        </div>
      ) : null}

      {(row.contact?.email || row.company.email || row.contact?.phone || row.company.phone) ? (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contatti</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            {row.contact?.email || row.company.email ? <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{row.contact?.email || row.company.email}</p> : null}
            {row.contact?.phone || row.company.phone ? <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{row.contact?.phone || row.company.phone}</p> : null}
          </div>
        </div>
      ) : null}

      {row.activeOpportunity ? (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opportunità attiva</h3>
          <div className="mt-3 rounded-xl border border-slate-200 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900"><FileText className="h-4 w-4" />{row.activeOpportunity.title}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{commercialMoney(row.activeOpportunity.value_estimate)}</p>
          </div>
        </div>
      ) : null}

      {row.activeOpportunity?.next_action ? (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prossima azione</h3>
          <p className="mt-3 flex items-start gap-2 text-sm text-slate-800">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{row.activeOpportunity.next_action}<span className="mt-1 block text-xs text-slate-500">{commercialDate(row.activeOpportunity.next_action_at, true)}</span></span>
          </p>
        </div>
      ) : null}

      <Button className="mt-8 h-11 w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={onOpen}>
        Apri scheda
        <ExternalLink className="ml-2 h-4 w-4" />
      </Button>
    </aside>
  );
}
