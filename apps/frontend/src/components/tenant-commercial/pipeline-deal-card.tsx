"use client";

import { CalendarClock, UserRound } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CommercialOpportunity } from "@/lib/tenant-commercial-api";
import { cn } from "@/lib/utils";
import { commercialDate, commercialMoney } from "./commercial-utils";

const stageOptions = [
  ["new_lead", "Nuovo lead"],
  ["to_contact", "Da contattare"],
  ["contacted", "Contattato"],
  ["call_scheduled", "Call fissata"],
  ["briefing_sent", "Brief inviato"],
  ["briefing_received", "Brief ricevuto"],
  ["quote_preparation", "Preventivo in preparazione"],
  ["quote_sent", "Preventivo inviato"],
  ["follow_up", "Follow-up"],
  ["accepted", "Vinta"],
  ["lost", "Persa"],
  ["paused", "In pausa"],
] as const;

export function PipelineDealCard({
  item,
  showEconomic,
  onMove,
}: {
  item: CommercialOpportunity;
  showEconomic: boolean;
  onMove: (id: string, stage: string) => void;
}) {
  const followUpDue = item.next_action_at && new Date(item.next_action_at).getTime() <= Date.now();

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-indigo-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-950">{item.company_name || item.title}</h3>
          <p className="mt-1 truncate text-xs text-slate-600">{item.service_type || item.title}</p>
        </div>
        {showEconomic ? <span className="shrink-0 text-sm font-semibold text-slate-950">{commercialMoney(item.value_estimate)}</span> : null}
      </div>

      {followUpDue ? (
        <span className="mt-3 inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-700">
          <CalendarClock className="h-3 w-3" /> Da ricontattare
        </span>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <p className={cn("min-w-0 flex-1 truncate text-[11px] text-slate-500", followUpDue && "text-orange-600")}>
          {item.stage === "accepted" ? "Vinta" : "Ultimo aggiornamento"}: {commercialDate(item.updated_at)}
        </p>
        {item.assigned_to ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600" title="Opportunità assegnata">
            <UserRound className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>

      <Select value={item.stage} onValueChange={(stage) => onMove(item.id, stage)}>
        <SelectTrigger className="mt-3 h-8 rounded-lg border-slate-200 text-xs" aria-label={`Sposta ${item.title}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {stageOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
    </article>
  );
}
