"use client";

import { useEffect, useRef } from "react";
import { CalendarClock, Eye, Globe2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CommercialOpportunity } from "@/lib/tenant-commercial-api";
import { compactIntakeGoal, intakeAttributionLabel, intakeText, parseIntakeFormData } from "@/lib/public-lead-intake";
import { cn } from "@/lib/utils";
import { DOFLOW_COMMERCIAL_STAGE_OPTIONS, LEGACY_COMMERCIAL_STAGE_OPTIONS } from "@/lib/commercial-stage-model";
import { commercialDate, commercialMoney } from "./commercial-utils";

export function PipelineDealCard({
  item,
  showEconomic,
  onMove,
  onOpenDetails,
  highlighted = false,
  doflow,
  disabled = false,
}: {
  item: CommercialOpportunity;
  showEconomic: boolean;
  onMove: (id: string, stage: string) => void;
  onOpenDetails: (item: CommercialOpportunity, trigger?: HTMLElement | null) => void;
  highlighted?: boolean;
  doflow: boolean;
  disabled?: boolean;
}) {
  const stageOptions = doflow ? DOFLOW_COMMERCIAL_STAGE_OPTIONS : LEGACY_COMMERCIAL_STAGE_OPTIONS;
  const followUpDue = item.next_action_at && new Date(item.next_action_at).getTime() <= Date.now();
  const cardRef = useRef<HTMLElement | null>(null);
  const intake = parseIntakeFormData(item.intake_form_data);
  const projectType = intake.projectType || intakeText(item.service_type) || item.title;
  const goals = intake.goals.length
    ? intake.goals
    : (intakeText(item.lead_interest)?.split(",").map((goal) => goal.trim()).filter(Boolean) || []);
  const timeline = intake.timeline || intakeText(item.lead_urgency);
  const attribution = intakeAttributionLabel(item.intake_attribution);
  const client = [intakeText(item.contact_name), intakeText(item.company_name)].filter(Boolean).join(" · ") || item.title;

  useEffect(() => {
    if (!highlighted) return;
    cardRef.current?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }, [highlighted]);

  return (
    <article
      ref={cardRef}
      data-commercial-deal
      data-visual-sensitive
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-indigo-200",
        highlighted && "border-indigo-400 ring-2 ring-indigo-200",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-950">{client}</h3>
            {item.lead_source === "website_form" ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                <Globe2 className="h-3 w-3" aria-hidden="true" />
                Sito web
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs font-medium text-slate-700">{projectType}</p>
        </div>
        {showEconomic ? <span className="shrink-0 text-sm font-semibold text-slate-950">{commercialMoney(item.value_estimate)}</span> : null}
      </div>

      {goals.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {goals.slice(0, 2).map((goal) => (
            <span key={goal} className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
              {compactIntakeGoal(goal)}
            </span>
          ))}
        </div>
      ) : null}

      {timeline || intake.province ? (
        <p className="mt-2 truncate text-[11px] text-slate-500">{[timeline, intake.province].filter(Boolean).join(" · ")}</p>
      ) : null}

      {item.lead_source === "website_form" && attribution ? (
        <p className="mt-1 truncate text-[11px] text-sky-700">Sito web · {attribution}</p>
      ) : null}

      {followUpDue ? (
        <span className="mt-3 inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-700">
          <CalendarClock className="h-3 w-3" /> Da ricontattare
        </span>
      ) : null}

      {item.next_action ? (
        <p className="mt-2 line-clamp-1 text-[11px] font-medium text-slate-600">{item.next_action}</p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <p className={cn("min-w-0 flex-1 truncate text-[11px] text-slate-500", followUpDue && "text-orange-600")}>
          {item.stage === (doflow ? "closed_won" : "accepted") ? (doflow ? "Chiuso" : "Vinta") : "Ultimo aggiornamento"}: {commercialDate(item.updated_at)}
        </p>
        {item.assigned_to ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600" title="Opportunità assegnata">
            <UserRound className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>

      <Select value={item.stage} onValueChange={(stage) => onMove(item.id, stage)} disabled={disabled}>
        <SelectTrigger className="mt-3 h-8 rounded-lg border-slate-200 text-xs" aria-label={`Sposta ${item.title}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {stageOptions.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Button type="button" variant="ghost" size="sm" className="mt-2 h-8 w-full text-xs text-indigo-700" onClick={(event) => onOpenDetails(item, event.currentTarget)}>
        <Eye className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Dettagli
      </Button>
    </article>
  );
}
