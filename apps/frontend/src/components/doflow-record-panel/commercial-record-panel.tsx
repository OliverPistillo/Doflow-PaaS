"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, ExternalLink, Mail, MessageCircle, Phone, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { apiFetch } from "@/lib/api";
import {
  commercialApi,
  type CommercialActivity,
  type CommercialCompany,
  type CommercialContact,
  type CommercialOpportunity,
} from "@/lib/tenant-commercial-api";
import {
  DOFLOW_PROJECT_STAGE_OPTIONS,
  normalizeProjectStage,
  projectStageLabel,
} from "@/lib/project-stage-model";
import { teamApi, type TeamMember } from "@/lib/tenant-team-api";
import type { CommercialClientRow } from "@/components/tenant-commercial/commercial-client-types";
import { pipelineStageLabel } from "@/components/tenant-commercial/commercial-utils";
import { UnifiedRecordPanel, type RecordPanelAction, type RecordPanelTab } from "./unified-record-panel";
import { RecordOverview, type RecordPanelOverviewModel } from "./record-overview";
import { RecordTimeline, type ComposerKind, type RecordTimelineHandle } from "./record-timeline";
import { RecordFiles, type RecordFilesHandle } from "./record-files";
import { RecordAdministration, type RecordAdministrationHandle } from "./record-administration";

type ProjectRecord = Record<string, any>;
type ListResponse<T> = { items: T[]; total?: number };

const companyStatusLabels: Record<string, string> = {
  active_client: "Cliente attivo",
  prospect: "Potenziale",
  former_client: "Ex cliente",
  partner: "Partner",
  dormant: "Da ricontattare",
};

function timestamp(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function sortActivities(items: CommercialActivity[]) {
  return [...items].sort((a, b) => timestamp(b.completed_at || b.updated_at || b.created_at) - timestamp(a.completed_at || a.updated_at || a.created_at));
}

function contactName(contact?: CommercialContact | null, fallback?: string | null) {
  const name = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : "";
  return name || fallback || null;
}

function nextProjectStage(project?: ProjectRecord | null) {
  if (!project) return null;
  const normalized = normalizeProjectStage(project.status);
  if (!normalized.mapped || normalized.stage === "paused") return null;
  const stages = DOFLOW_PROJECT_STAGE_OPTIONS.filter((item) => item.value !== "paused");
  const index = stages.findIndex((item) => item.value === normalized.stage);
  return index >= 0 ? stages[index + 1]?.label || null : null;
}

function isProjectPaused(project?: ProjectRecord | null) {
  const normalized = normalizeProjectStage(project?.status);
  return normalized.mapped && normalized.stage === "paused";
}

function primaryFooter(className = "") {
  return `h-10 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-xs font-semibold text-white shadow-sm hover:from-blue-700 hover:to-violet-700 ${className}`;
}

export function DoflowCommercialRecordPanel({
  kind,
  recordId,
  fallbackOpportunity,
  fallbackClient,
  activeTab,
  onTabChange,
  onClose,
  showEconomic: _showEconomic,
}: {
  kind: "opportunity" | "company";
  recordId: string;
  fallbackOpportunity?: CommercialOpportunity | null;
  fallbackClient?: CommercialClientRow | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onClose: () => void;
  showEconomic: boolean;
}) {
  const { canView, canCreate } = useTenantAccess();
  const [opportunity, setOpportunity] = useState<CommercialOpportunity | null>(fallbackOpportunity || null);
  const [company, setCompany] = useState<CommercialCompany | null>(fallbackClient?.company || null);
  const [contact, setContact] = useState<CommercialContact | null>(fallbackClient?.contact || null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [activities, setActivities] = useState<CommercialActivity[]>(fallbackClient?.lastActivity ? [fallbackClient.lastActivity] : []);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [timelineDraft, setTimelineDraft] = useState<{ key: number; kind: ComposerKind; body?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timelineRef = useRef<RecordTimelineHandle>(null);
  const filesRef = useRef<RecordFilesHandle>(null);
  const administrationRef = useRef<RecordAdministrationHandle>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        if (kind === "opportunity") {
          const detail = await commercialApi.opportunity(recordId);
          if (cancelled) return;
          setOpportunity(detail);
          const [activityResult, companyResult, contactResult, memberResult, projectResult] = await Promise.allSettled([
            commercialApi.activities({ opportunity_id: recordId, limit: 100, sortBy: "updated_at" }),
            detail.company_id ? commercialApi.company(detail.company_id) : Promise.resolve(null),
            detail.contact_id ? commercialApi.contact(detail.contact_id) : Promise.resolve(null),
            canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] }),
            canView("projects") && detail.company_id
              ? apiFetch<ListResponse<ProjectRecord>>(`/tenant/projects?company_id=${encodeURIComponent(detail.company_id)}&limit=100`)
              : Promise.resolve({ items: [] }),
          ]);
          if (cancelled) return;
          if (activityResult.status === "fulfilled") setActivities(sortActivities(activityResult.value.items || []));
          if (companyResult.status === "fulfilled") setCompany(companyResult.value);
          if (contactResult.status === "fulfilled") setContact(contactResult.value);
          if (memberResult.status === "fulfilled") setMembers(memberResult.value.items || []);
          if (projectResult.status === "fulfilled") setProject(projectResult.value.items.find((item) => item.opportunity_id === recordId) || null);
        } else {
          const detail = await commercialApi.company(recordId);
          if (cancelled) return;
          setCompany(detail);
          const [contactResult, opportunityResult, activityResult, memberResult, projectResult] = await Promise.allSettled([
            commercialApi.contacts({ company_id: recordId, limit: 100 }),
            commercialApi.opportunities({ company_id: recordId, limit: 100 }),
            commercialApi.activities({ company_id: recordId, limit: 100, sortBy: "updated_at" }),
            canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] }),
            canView("projects") ? apiFetch<ListResponse<ProjectRecord>>(`/tenant/projects?company_id=${encodeURIComponent(recordId)}&limit=100`) : Promise.resolve({ items: [] }),
          ]);
          if (cancelled) return;
          if (contactResult.status === "fulfilled") setContact(contactResult.value.items.find((item) => item.is_primary) || contactResult.value.items[0] || null);
          if (opportunityResult.status === "fulfilled") setOpportunity(opportunityResult.value.items[0] || null);
          if (activityResult.status === "fulfilled") setActivities(sortActivities(activityResult.value.items || []));
          if (memberResult.status === "fulfilled") setMembers(memberResult.value.items || []);
          if (projectResult.status === "fulfilled") setProject(projectResult.value.items[0] || null);
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Record non disponibile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [canView, kind, recordId]);

  const currentOpportunity = kind === "opportunity" ? opportunity : opportunity || fallbackClient?.activeOpportunity || null;
  const phone = contact?.phone || currentOpportunity?.contact_phone || company?.phone;
  const email = contact?.email || currentOpportunity?.contact_email || company?.email;
  const commercialStatus = kind === "opportunity"
    ? pipelineStageLabel(currentOpportunity?.stage || "", true)
    : companyStatusLabels[company?.status || ""] || company?.status || "Non definito";
  const projectStatus = project ? projectStageLabel(project.status, true) : null;
  const progress = project ? Math.max(0, Math.min(100, Number(project.progress || 0))) : null;
  const nextActivity = activities.find((item) => !item.completed_at);

  const overviewModel = useMemo<RecordPanelOverviewModel>(() => ({
    recordKind: kind,
    recordId,
    nextAction: currentOpportunity?.next_action
      ? { title: currentOpportunity.next_action, dueAt: currentOpportunity.next_action_at }
      : nextActivity ? { title: nextActivity.title, dueAt: nextActivity.due_at } : null,
    contact: { name: contactName(contact, currentOpportunity?.contact_name), email, phone },
    project: project ? {
      id: project.id,
      statusLabel: projectStatus || "Fase non definita",
      progress: progress || 0,
      nextStageLabel: nextProjectStage(project),
      paused: isProjectPaused(project),
    } : null,
    activitySummary: {
      open: activities.filter((item) => !item.completed_at).length,
      blocked: 0,
    },
  }), [activities, contact, currentOpportunity, email, kind, nextActivity, phone, progress, project, projectStatus, recordId]);

  const compose = (composer: ComposerKind, body?: string) => {
    setTimelineDraft({ key: Date.now(), kind: composer, body });
    onTabChange("activity");
    window.setTimeout(() => timelineRef.current?.compose(composer), 0);
  };

  const actions: RecordPanelAction[] = [
    ...(project ? [{ label: "Apri progetto", icon: ExternalLink, href: `/projects/${encodeURIComponent(project.id)}`, primary: true }] : []),
    { label: "Chiama", icon: Phone, onSelect: () => compose("call"), disabled: !phone, disabledReason: "Numero non disponibile" },
    { label: "WhatsApp", icon: MessageCircle, onSelect: () => compose("whatsapp"), disabled: !phone, disabledReason: "Numero non disponibile" },
    { label: "Email", icon: Mail, onSelect: () => compose("email"), disabled: !email, disabledReason: "Email non disponibile" },
    { label: "Attività", icon: CalendarPlus, onSelect: () => compose("activity") },
  ];

  const tabs: RecordPanelTab[] = [
    {
      value: "overview",
      label: "Riepilogo",
      content: <RecordOverview model={overviewModel} onOpenActivity={() => compose("activity")} />,
      footer: <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-10 rounded-lg border-[#dedfe6] text-xs" onClick={() => compose("note")}><MessageCircle className="mr-2 h-4 w-4" />Aggiungi nota</Button><Button className={primaryFooter()} onClick={() => compose("activity")}><Plus className="mr-2 h-4 w-4" />Nuova attività</Button></div>,
    },
    {
      value: "activity",
      label: "Attività",
      content: <RecordTimeline ref={timelineRef} recordKind={kind} recordId={recordId} moduleKey="crm" phone={phone} email={email} members={members} draft={timelineDraft} />,
      footer: canCreate("crm") ? <Button className={primaryFooter("w-full")} onClick={() => timelineRef.current?.compose("activity")}><Plus className="mr-2 h-4 w-4" />Nuova attività</Button> : null,
    },
    {
      value: "files",
      label: "File",
      content: <RecordFiles ref={filesRef} recordKind={kind} recordId={recordId} onSolicit={(channel, body) => compose(channel, body)} />,
      footer: canCreate("documents") ? <Button className={primaryFooter("w-full")} onClick={() => filesRef.current?.openUpload()}><Upload className="mr-2 h-4 w-4" />Carica file</Button> : null,
    },
    {
      value: "administration",
      label: "Amministrazione",
      content: <RecordAdministration ref={administrationRef} recordKind={kind} recordId={recordId} />,
      footer: canCreate("finance") ? <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-10 rounded-lg border-violet-300 text-xs text-violet-700" onClick={() => administrationRef.current?.openPayment()}>Registra pagamento</Button><Button asChild className={primaryFooter()}><Link href={`/finance/invoices/new?${kind}=${encodeURIComponent(recordId)}`}><Plus className="mr-2 h-4 w-4" />Crea fattura</Link></Button></div> : null,
    },
  ];

  const title = project ? company?.name || currentOpportunity?.company_name || project.name : kind === "opportunity" ? currentOpportunity?.title || "Dettaglio opportunità" : company?.name || "Dettaglio cliente";
  const subtitle = project ? project.name : kind === "opportunity" ? currentOpportunity?.company_name || company?.name : currentOpportunity?.service_type || company?.industry;

  return <UnifiedRecordPanel
    open
    onClose={onClose}
    eyebrow={project ? "Cliente e progetto" : kind === "opportunity" ? "Opportunità" : "Cliente"}
    title={title}
    subtitle={subtitle}
    status={projectStatus || commercialStatus}
    progress={progress}
    actions={actions}
    tabs={tabs}
    activeTab={activeTab}
    onTabChange={onTabChange}
    loading={loading}
    error={error}
  />;
}
