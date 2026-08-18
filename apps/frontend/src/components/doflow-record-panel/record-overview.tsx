"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, Clock3, FileCheck2, Files, Mail, MessageCircle, Phone,
  UserRound, Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { financeMoney } from "@/components/tenant-administration/administration-model";
import { listDocumentsForEntity, type TenantDocument } from "@/lib/tenant-documents-api";
import { recordOperationsApi, type MaterialRequest, type OperationsRecordKind, type RecordAdministration } from "@/lib/tenant-record-operations-api";
import { timelineApi, type TimelineEvent } from "@/lib/tenant-timeline-api";
import { cn } from "@/lib/utils";
import { RecordPanelSection } from "./unified-record-panel";

export type RecordPanelOverviewModel = {
  recordKind: OperationsRecordKind;
  recordId: string;
  nextAction?: { title: string; dueAt?: string | null } | null;
  contact?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  project?: {
    id: string;
    statusLabel: string;
    progress: number;
    nextStageLabel?: string | null;
    paused?: boolean;
  } | null;
  activitySummary?: { open: number; blocked?: number } | null;
};

function shortDate(value?: string | null, includeTime = false) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(parsed);
}

function relativeDate(value?: string | null) {
  if (!value) return "Scadenza non indicata";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Scadenza non indicata";
  const delta = parsed.getTime() - Date.now();
  const days = Math.round(delta / 86_400_000);
  if (Math.abs(days) <= 7) return new Intl.RelativeTimeFormat("it-IT", { numeric: "auto" }).format(days, "day");
  return shortDate(value);
}

function communicationIcon(type?: string) {
  if (type === "whatsapp") return MessageCircle;
  if (type === "email") return Mail;
  return Phone;
}

function signedContract(data?: RecordAdministration | null) {
  return data?.contracts.find((contract) => String(contract.signature_status || "").toLowerCase() === "signed") || null;
}

export function RecordOverview({ model, onOpenActivity }: { model: RecordPanelOverviewModel; onOpenActivity: () => void }) {
  const { canView } = useTenantAccess();
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [materials, setMaterials] = useState<MaterialRequest[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [administration, setAdministration] = useState<RecordAdministration | null>(null);

  useEffect(() => {
    let cancelled = false;
    const target = { record_kind: model.recordKind, record_id: model.recordId };
    const requests: Array<Promise<void>> = [];
    requests.push(timelineApi.list(target, { limit: 20 }).then((page) => {
      if (!cancelled) setTimeline(page.items || []);
    }).catch(() => undefined));
    if (canView("documents")) {
      requests.push(Promise.all([
        listDocumentsForEntity(model.recordKind, model.recordId, { status: "active", limit: 100 }),
        recordOperationsApi.materials(target),
      ]).then(([documentPage, materialPage]) => {
        if (cancelled) return;
        setDocuments(documentPage.items || []);
        setMaterials(materialPage.items || []);
      }).catch(() => undefined));
    }
    if (canView("finance")) {
      requests.push(recordOperationsApi.administration(target).then((data) => {
        if (!cancelled) setAdministration(data);
      }).catch(() => undefined));
    }
    void Promise.allSettled(requests);
    return () => { cancelled = true; };
  }, [canView, model.recordId, model.recordKind]);

  const latestCommunication = useMemo(() => (
    timeline.find((event) => ["whatsapp", "email", "call"].includes(event.type)) || timeline[0] || null
  ), [timeline]);
  const contract = signedContract(administration);
  const requestedMaterials = materials.filter((item) => item.status === "requested").length;
  const fileCount = documents.length;
  const summary = administration?.summary;

  return <div className="space-y-2.5" data-record-overview-v2>
    {model.nextAction ? <RecordPanelSection title="Prossima azione">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm"><Clock3 className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-slate-950" data-record-sensitive>{model.nextAction.title}</span>
          <span className="mt-0.5 block text-[11px] text-slate-500">{relativeDate(model.nextAction.dueAt)}</span>
        </span>
        <Button type="button" size="sm" className="h-8 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-xs shadow-sm" onClick={onOpenActivity}>Apri</Button>
      </div>
    </RecordPanelSection> : null}

    {model.contact?.name || model.contact?.email || model.contact?.phone ? <RecordPanelSection title="Referente">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700"><UserRound className="h-5 w-5" /></span>
        <span className="min-w-0 text-xs leading-5 text-slate-500">
          {model.contact.name ? <strong className="block truncate text-[13px] font-semibold text-slate-900" data-record-sensitive>{model.contact.name}</strong> : null}
          {model.contact.email ? <a className="block truncate hover:text-violet-700" href={`mailto:${model.contact.email}`} data-record-sensitive>{model.contact.email}</a> : null}
          {model.contact.phone ? <a className="block truncate hover:text-violet-700" href={`tel:${model.contact.phone}`} data-record-sensitive>{model.contact.phone}</a> : null}
        </span>
      </div>
    </RecordPanelSection> : null}

    {model.project ? <RecordPanelSection title="Avanzamento">
      <div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-800">Progetto</span><strong className="text-sm text-violet-700">{model.project.progress}%</strong></div>
      <Progress value={model.project.progress} className="mt-2 h-1.5 bg-slate-100" />
      <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px] text-slate-500">
        <span>Fase attuale: <Badge className="ml-1 h-5 border-0 bg-violet-50 px-2 text-[10px] text-violet-700 hover:bg-violet-50">{model.project.statusLabel}</Badge></span>
        {model.project.nextStageLabel && !model.project.paused ? <span>Prossima: <strong className="text-slate-800">{model.project.nextStageLabel}</strong></span> : null}
      </div>
    </RecordPanelSection> : null}

    {model.activitySummary || canView("documents") ? <div className="grid grid-cols-2 gap-2.5">
      {model.activitySummary ? <RecordPanelSection title="Attività" className="min-h-[94px]">
        <p className="flex items-center gap-2 text-xs text-slate-600"><Workflow className="h-4 w-4 text-violet-600" /><strong className="text-lg text-slate-950">{model.activitySummary.open}</strong> aperte</p>
        {model.activitySummary.blocked ? <p className="mt-1 flex items-center gap-2 text-[11px] text-rose-600"><span className="h-2 w-2 rounded-full bg-rose-500" />{model.activitySummary.blocked} bloccate</p> : null}
      </RecordPanelSection> : null}
      {canView("documents") ? <RecordPanelSection title="File" className="min-h-[94px]">
        <p className="flex items-center gap-2 text-xs text-slate-600"><Files className="h-4 w-4 text-blue-600" /><strong className="text-lg text-slate-950">{fileCount}</strong> file</p>
        {contract ? <p className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Contratto firmato</p> : requestedMaterials ? <p className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-700"><FileCheck2 className="h-3.5 w-3.5" />{requestedMaterials} da ricevere</p> : null}
      </RecordPanelSection> : null}
    </div> : null}

    {latestCommunication ? <RecordPanelSection title="Ultima comunicazione">
      <div className="flex items-start gap-3">
        {(() => { const Icon = communicationIcon(latestCommunication.type); return <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white", latestCommunication.type === "whatsapp" ? "bg-emerald-500" : "bg-violet-600")}><Icon className="h-4 w-4" /></span>; })()}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block text-xs leading-5 text-slate-700" data-record-sensitive>{latestCommunication.body || latestCommunication.title}</span>
          <span className="mt-1 block text-[11px] text-slate-500">{shortDate(latestCommunication.created_at, true)} · <span data-record-sensitive>{latestCommunication.author_label}</span></span>
        </span>
      </div>
    </RecordPanelSection> : null}

    {canView("finance") && summary ? <RecordPanelSection title="Amministrazione">
      <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 text-[11px] text-slate-500">
        <span>Pagato</span><Badge className="h-5 border-0 bg-emerald-50 px-2 text-[10px] text-emerald-700 hover:bg-emerald-50">{financeMoney(summary.total_paid, undefined, 0)}</Badge>
        <span className="text-right">Saldo <strong className="text-slate-900" data-record-sensitive>{financeMoney(summary.total_remaining, undefined, 0)}</strong></span>
        <Badge className={cn("h-5 border-0 px-2 text-[10px]", summary.total_remaining > 0 ? "bg-amber-50 text-amber-700 hover:bg-amber-50" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-50")}>{summary.total_remaining > 0 ? "Da incassare" : "Pagato"}</Badge>
      </div>
    </RecordPanelSection> : null}
  </div>;
}
