"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardPlus, FilePlus2, Globe2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CommercialOpportunity } from "@/lib/tenant-commercial-api";
import { getDoFlowUser } from "@/lib/jwt";
import { isInternalDoflowTenant } from "@/lib/tenant-url";
import {
  compactIntakeGoal,
  intakeAttributionLabel,
  intakeText,
  parseIntakeFormData,
} from "@/lib/public-lead-intake";
import { commercialDate, commercialMoney, pipelineStageLabel } from "./commercial-utils";

function fallbackGoals(value: unknown): string[] {
  const text = intakeText(value);
  return text ? text.split(",").map((goal) => goal.trim()).filter(Boolean) : [];
}

function DetailValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{children || "-"}</dd>
    </div>
  );
}

export function OpportunityDetailSheet({
  opportunity,
  open,
  onOpenChange,
  showEconomic,
}: {
  opportunity: CommercialOpportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showEconomic: boolean;
}) {
  const user = getDoFlowUser();
  const doflow = isInternalDoflowTenant(user?.tenantSlug || user?.tenantId);
  const intake = parseIntakeFormData(opportunity?.intake_form_data);
  const projectType = intake.projectType || intakeText(opportunity?.service_type);
  const goals = intake.goals.length ? intake.goals : fallbackGoals(opportunity?.lead_interest);
  const timeline = intake.timeline || intakeText(opportunity?.lead_urgency);
  const attribution = intakeAttributionLabel(opportunity?.intake_attribution);
  const isWebsite = opportunity?.lead_source === "website_form";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-8">
          <SheetTitle>{opportunity?.title || "Dettaglio opportunità"}</SheetTitle>
          <SheetDescription>Contesto commerciale e prossime azioni della trattativa.</SheetDescription>
        </SheetHeader>

        {opportunity ? (
          <div className="mt-6 space-y-6 pb-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-950">Cliente</h3>
              <dl className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                <DetailValue label="Azienda">{opportunity.company_name || "-"}</DetailValue>
                <DetailValue label="Contatto">{opportunity.contact_name || "-"}</DetailValue>
                <DetailValue label="Email">
                  {opportunity.contact_email ? <a className="text-indigo-600 hover:underline" href={`mailto:${opportunity.contact_email}`}>{opportunity.contact_email}</a> : "-"}
                </DetailValue>
                <DetailValue label="Telefono">
                  {opportunity.contact_phone ? <a className="text-indigo-600 hover:underline" href={`tel:${opportunity.contact_phone}`}>{opportunity.contact_phone}</a> : "-"}
                </DetailValue>
              </dl>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-950">Richiesta</h3>
              <div className="rounded-xl border border-slate-200 p-4">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <DetailValue label="Progetto">{projectType || "-"}</DetailValue>
                  <DetailValue label="Tempistica">{timeline || "-"}</DetailValue>
                  <DetailValue label="Provincia">{intake.province || "-"}</DetailValue>
                </dl>
                {goals.length ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {goals.map((goal) => <Badge key={goal} variant="secondary">{compactIntakeGoal(goal)}</Badge>)}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-950">Provenienza</h3>
              <dl className="grid gap-3 rounded-xl border border-slate-200 p-4">
                <DetailValue label="Fonte">
                  <span className="inline-flex items-center gap-1.5">
                    {isWebsite ? <Globe2 className="h-4 w-4 text-sky-600" aria-hidden="true" /> : null}
                    {isWebsite ? "Sito web" : opportunity.lead_source || "-"}
                    {attribution ? ` · ${attribution}` : ""}
                  </span>
                </DetailValue>
                {opportunity.intake_landing_url ? (
                  <DetailValue label="Landing page">
                    <a className="break-all text-indigo-600 hover:underline" href={opportunity.intake_landing_url} target="_blank" rel="noreferrer">{opportunity.intake_landing_url}</a>
                  </DetailValue>
                ) : null}
                {opportunity.intake_source_origin ? <DetailValue label="Origine">{opportunity.intake_source_origin}</DetailValue> : null}
              </dl>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-950">Trattativa</h3>
              <dl className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                <DetailValue label="Fase">{pipelineStageLabel(opportunity.stage, doflow)}</DetailValue>
                {showEconomic ? <DetailValue label="Valore">{commercialMoney(opportunity.value_estimate)}</DetailValue> : null}
                {opportunity.probability !== null && opportunity.probability !== undefined ? <DetailValue label="Probabilità">{`${opportunity.probability}%`}</DetailValue> : null}
                <DetailValue label="Prossima azione">{opportunity.next_action || "-"}</DetailValue>
                <DetailValue label="Quando">{commercialDate(opportunity.next_action_at, true)}</DetailValue>
                {opportunity.assigned_to ? <DetailValue label="Assegnazione">Assegnata</DetailValue> : null}
              </dl>
            </section>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild>
                <Link href={`/briefings/new?opportunity=${encodeURIComponent(opportunity.id)}`}>
                  <ClipboardPlus className="mr-2 h-4 w-4" /> Avvia briefing
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/quotes/new?opportunity=${encodeURIComponent(opportunity.id)}`}>
                  <FilePlus2 className="mr-2 h-4 w-4" /> Crea preventivo
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
