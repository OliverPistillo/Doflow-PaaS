"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, ExternalLink, Mail, MessageCircle, Phone, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { apiFetch } from "@/lib/api";
import { commercialApi, type CommercialContact } from "@/lib/tenant-commercial-api";
import { teamApi, type TeamMember } from "@/lib/tenant-team-api";
import {
  canonicalizeProjectItem,
  DOFLOW_PROJECT_STAGE_OPTIONS,
  normalizeProjectStage,
  projectStageLabel,
} from "@/lib/project-stage-model";
import { UnifiedRecordPanel, type RecordPanelAction, type RecordPanelTab } from "./unified-record-panel";
import { RecordOverview, type RecordPanelOverviewModel } from "./record-overview";
import { RecordTimeline, type ComposerKind, type RecordTimelineHandle } from "./record-timeline";
import { RecordFiles, type RecordFilesHandle } from "./record-files";
import { RecordAdministration, type RecordAdministrationHandle } from "./record-administration";

type ProjectRecord = Record<string, any>;
type ProjectTask = Record<string, any>;
type ListResponse<T> = { items: T[]; total?: number };

function isTaskOpen(task: ProjectTask) {
  return task.status !== "done";
}

function nextStage(project?: ProjectRecord | null) {
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

function taskTime(task: ProjectTask) {
  const value = task.due_at ? new Date(task.due_at).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function primaryFooter(className = "") {
  return `h-10 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-xs font-semibold text-white shadow-sm hover:from-blue-700 hover:to-violet-700 ${className}`;
}

export function DoflowProjectRecordPanel({
  recordId,
  fallbackProject,
  activeTab,
  onTabChange,
  onClose,
}: {
  recordId: string;
  fallbackProject?: ProjectRecord | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onClose: () => void;
}) {
  const { canView, canCreate } = useTenantAccess();
  const [project, setProject] = useState<ProjectRecord | null>(fallbackProject || null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [contact, setContact] = useState<CommercialContact | null>(null);
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
        const detail = canonicalizeProjectItem(await apiFetch<ProjectRecord>(`/tenant/projects/${recordId}`));
        if (cancelled) return;
        setProject(detail);
        const [taskResult, contactResult, memberResult] = await Promise.allSettled([
          apiFetch<ListResponse<ProjectTask>>(`/tenant/projects/${recordId}/tasks?limit=100`),
          canView("crm") && detail.contact_id ? commercialApi.contact(detail.contact_id) : Promise.resolve(null),
          canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] }),
        ]);
        if (cancelled) return;
        if (taskResult.status === "fulfilled") setTasks(taskResult.value.items || []);
        if (contactResult.status === "fulfilled") setContact(contactResult.value);
        if (memberResult.status === "fulfilled") setMembers(memberResult.value.items || []);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Progetto non disponibile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [canView, recordId]);

  const phone = contact?.phone;
  const email = contact?.email;
  const openTasks = tasks.filter(isTaskOpen);
  const blockedTasks = openTasks.filter((task) => task.status === "blocked");
  const nextTask = [...openTasks].sort((a, b) => taskTime(a) - taskTime(b))[0] || null;
  const status = projectStageLabel(project?.status, true);
  const progress = Math.max(0, Math.min(100, Number(project?.progress || 0)));
  const contactDisplayName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : project?.contact_name || null;

  const overviewModel = useMemo<RecordPanelOverviewModel>(() => ({
    recordKind: "project",
    recordId,
    nextAction: nextTask ? { title: nextTask.title, dueAt: nextTask.due_at } : null,
    contact: { name: contactDisplayName, email, phone },
    project: project ? {
      id: recordId,
      statusLabel: status,
      progress,
      nextStageLabel: nextStage(project),
      paused: isProjectPaused(project),
    } : null,
    activitySummary: { open: openTasks.length, blocked: blockedTasks.length },
  }), [blockedTasks.length, contactDisplayName, email, nextTask, openTasks.length, phone, progress, project, recordId, status]);

  const compose = (composer: ComposerKind, body?: string) => {
    setTimelineDraft({ key: Date.now(), kind: composer, body });
    onTabChange("activity");
    window.setTimeout(() => timelineRef.current?.compose(composer), 0);
  };

  const actions: RecordPanelAction[] = [
    { label: "Apri progetto", icon: ExternalLink, href: `/projects/${encodeURIComponent(recordId)}`, primary: true },
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
      content: <RecordTimeline ref={timelineRef} recordKind="project" recordId={recordId} moduleKey="projects" phone={phone} email={email} members={members} draft={timelineDraft} />,
      footer: canCreate("projects") ? <Button className={primaryFooter("w-full")} onClick={() => timelineRef.current?.compose("activity")}><Plus className="mr-2 h-4 w-4" />Nuova attività</Button> : null,
    },
    {
      value: "files",
      label: "File",
      content: <RecordFiles ref={filesRef} recordKind="project" recordId={recordId} onSolicit={(channel, body) => compose(channel, body)} />,
      footer: canCreate("documents") ? <Button className={primaryFooter("w-full")} onClick={() => filesRef.current?.openUpload()}><Upload className="mr-2 h-4 w-4" />Carica file</Button> : null,
    },
    {
      value: "administration",
      label: "Amministrazione",
      content: <RecordAdministration ref={administrationRef} recordKind="project" recordId={recordId} />,
      footer: canCreate("finance") ? <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-10 rounded-lg border-violet-300 text-xs text-violet-700" onClick={() => administrationRef.current?.openPayment()}>Registra pagamento</Button><Button asChild className={primaryFooter()}><Link href={`/finance/invoices/new?project=${encodeURIComponent(recordId)}`}><Plus className="mr-2 h-4 w-4" />Crea fattura</Link></Button></div> : null,
    },
  ];

  return <UnifiedRecordPanel
    open
    onClose={onClose}
    eyebrow="Cliente e progetto"
    title={project?.company_name || project?.name || "Dettaglio progetto"}
    subtitle={project?.name || "Progetto"}
    status={status}
    progress={progress}
    actions={actions}
    tabs={tabs}
    activeTab={activeTab}
    onTabChange={onTabChange}
    loading={loading}
    error={error}
  />;
}
