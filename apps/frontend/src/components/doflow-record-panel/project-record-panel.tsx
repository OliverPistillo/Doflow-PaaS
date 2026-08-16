"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, FileText, Mail, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { apiFetch } from "@/lib/api";
import { commercialApi, type CommercialContact } from "@/lib/tenant-commercial-api";
import { listDocumentsForEntity, type TenantDocument } from "@/lib/tenant-documents-api";
import {
  canonicalizeProjectItem,
  DOFLOW_PROJECT_STAGE_OPTIONS,
  normalizeProjectStage,
  projectStageLabel,
} from "@/lib/project-stage-model";
import {
  RecordPanelEmptyState,
  RecordPanelField,
  RecordPanelSection,
  UnifiedRecordPanel,
  type RecordPanelAction,
  type RecordPanelTab,
} from "./unified-record-panel";

type ProjectRecord = Record<string, any>;
type ProjectTask = Record<string, any>;
type ListResponse<T> = { items: T[]; total?: number };

const taskStatusLabels: Record<string, string> = {
  backlog: "Backlog",
  ready: "Pronto",
  in_progress: "In corso",
  internal_review: "Review interna",
  client_review: "Review cliente",
  blocked: "Bloccato",
  done: "Completato",
};

const priorityLabels: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

function whatsappHref(phone?: string | null) {
  const normalized = String(phone || "").replace(/[^0-9]/g, "");
  return normalized ? `https://wa.me/${normalized}` : undefined;
}

function isTaskOpen(task: ProjectTask) {
  return task.status !== "done";
}

function isTaskOverdue(task: ProjectTask) {
  return isTaskOpen(task) && task.due_at && new Date(task.due_at).getTime() < Date.now();
}

function ProjectFlow({ project }: { project: ProjectRecord }) {
  const normalized = normalizeProjectStage(project.status);
  const current = normalized.mapped ? normalized.stage : null;
  const positiveStages = DOFLOW_PROJECT_STAGE_OPTIONS.filter((stage) => stage.value !== "paused");
  const currentPositiveIndex = positiveStages.findIndex((stage) => stage.value === current);
  return (
    <div className="space-y-4">
      <RecordPanelSection title="Flusso di lavoro" description="La fase deriva esclusivamente da projects.status; le milestone restano indipendenti.">
        <ol className="space-y-1">
          {DOFLOW_PROJECT_STAGE_OPTIONS.map((stage, index) => {
            const isCurrent = stage.value === current;
            const completed = stage.value !== "paused" && current !== "paused" && currentPositiveIndex > index;
            return (
              <li key={stage.value} className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${isCurrent ? "border-violet-300 bg-violet-50" : "border-transparent"}`} aria-current={isCurrent ? "step" : undefined}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${isCurrent ? "border-violet-600 bg-violet-600 text-white" : completed ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-500"}`}>
                  {completed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </span>
                <span className={`text-sm font-medium ${isCurrent ? "text-violet-800" : "text-slate-700"}`}>{stage.label}</span>
                {isCurrent ? <span className="ml-auto rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-violet-700">Fase corrente</span> : null}
              </li>
            );
          })}
        </ol>
      </RecordPanelSection>
      {!normalized.mapped ? <RecordPanelEmptyState title="Fase da verificare" description="Il valore corrente non è mappato e non viene trasformato automaticamente." /> : null}
    </div>
  );
}

function ProjectTasks({ tasks }: { tasks: ProjectTask[] }) {
  if (!tasks.length) {
    return <RecordPanelEmptyState title="Nessuna attività collegata" description="Le attività reali del progetto compariranno qui senza modificare stati task o milestone." action={<Button asChild variant="outline" size="sm"><Link href="/projects/tasks">Apri attività</Link></Button>} />;
  }
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <article key={task.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-950" data-record-sensitive>{task.title}</h3><p className="mt-1 text-xs text-slate-500">{task.assignee_email ? <span data-record-sensitive>{task.assignee_email}</span> : "Non assegnata"}</p></div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{taskStatusLabels[task.status] || task.status || "—"}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>Scadenza {formatDate(task.due_at)}</span><span>Priorità {priorityLabels[task.priority] || task.priority || "—"}</span>{isTaskOverdue(task) ? <span className="font-semibold text-rose-600">Scaduta</span> : null}</div>
        </article>
      ))}
    </div>
  );
}

function ProjectFiles({ projectId, documents }: { projectId: string; documents: TenantDocument[] }) {
  if (!documents.length) {
    return <RecordPanelEmptyState title="Nessun file collegato" description="Carica o collega un documento reale al progetto dall’archivio Documenti." action={<Button asChild variant="outline" size="sm"><Link href={`/documents/upload?entity_type=project&entity_id=${encodeURIComponent(projectId)}&category=project_asset`}>Carica documento</Link></Button>} />;
  }
  return (
    <div className="space-y-2">
      {documents.map((document) => (
        <Link key={document.id} href={`/documents/${document.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-violet-300 hover:bg-violet-50/30">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><FileText className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900" data-record-sensitive>{document.title}</span><span className="block text-xs text-slate-500">{document.category} · {formatDate(document.created_at)}</span></span>
          <span className="text-xs font-medium text-violet-700">Apri</span>
        </Link>
      ))}
    </div>
  );
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
  const { canView } = useTenantAccess();
  const [project, setProject] = useState<ProjectRecord | null>(fallbackProject || null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [contact, setContact] = useState<CommercialContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const detail = canonicalizeProjectItem(await apiFetch<ProjectRecord>(`/tenant/projects/${recordId}`));
        if (cancelled) return;
        setProject(detail);
        const [taskResult, documentResult, contactResult] = await Promise.allSettled([
          apiFetch<ListResponse<ProjectTask>>(`/tenant/projects/${recordId}/tasks?limit=100`),
          canView("documents") ? listDocumentsForEntity("project", recordId, { limit: 100 }) : Promise.resolve({ items: [] }),
          canView("crm") && detail.contact_id ? commercialApi.contact(detail.contact_id) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (taskResult.status === "fulfilled") setTasks(taskResult.value.items || []);
        if (documentResult.status === "fulfilled") setDocuments(documentResult.value.items || []);
        if (contactResult.status === "fulfilled") setContact(contactResult.value);
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
  const overdueTasks = tasks.filter(isTaskOverdue);
  const status = projectStageLabel(project?.status, true);
  const progress = Number(project?.progress || 0);
  const overview = (
    <div className="space-y-4">
      <RecordPanelSection title="Percorso progetto">
        <div className="flex items-center justify-between gap-4"><span className="text-sm font-semibold text-violet-700">{status}</span><span className="text-sm font-bold text-slate-950">{progress}%</span></div>
        <Progress value={progress} className="mt-3 h-2" />
      </RecordPanelSection>
      <RecordPanelSection title="Panoramica">
        <dl className="grid gap-4 sm:grid-cols-2">
          <RecordPanelField label="Fase" value={status} />
          <RecordPanelField label="Avanzamento" value={`${progress}%`} />
          <RecordPanelField label="Priorità" value={priorityLabels[project?.priority] || project?.priority || "—"} />
          <RecordPanelField label="Project manager" value={project?.project_manager_email || "Non assegnato"} sensitive />
          <RecordPanelField label="Scadenza" value={formatDate(project?.due_date)} />
          <RecordPanelField label="Cliente" value={project?.company_name || "Non collegato"} sensitive />
          <RecordPanelField label="Attività aperte" value={openTasks.length} />
          <RecordPanelField label="Attività scadute" value={overdueTasks.length} />
          <RecordPanelField label="Ultimo aggiornamento" value={formatDate(project?.updated_at, true)} />
        </dl>
      </RecordPanelSection>
      {contact ? <RecordPanelSection title="Referente cliente"><dl className="grid gap-4 sm:grid-cols-2"><RecordPanelField label="Nome" value={[contact.first_name, contact.last_name].filter(Boolean).join(" ")} sensitive /><RecordPanelField label="Email" value={contact.email || "—"} sensitive /><RecordPanelField label="Telefono" value={contact.phone || "—"} sensitive /></dl></RecordPanelSection> : null}
    </div>
  );

  const tabs = useMemo<RecordPanelTab[]>(() => [
    { value: "overview", label: "Panoramica", content: overview },
    { value: "flow", label: "Flusso", content: project ? <ProjectFlow project={project} /> : null },
    { value: "activity", label: "Attività", content: <ProjectTasks tasks={tasks} /> },
    { value: "files", label: "File", content: <ProjectFiles projectId={recordId} documents={documents} /> },
  ], [documents, overview, project, recordId, tasks]);

  const actions: RecordPanelAction[] = [
    { label: "Chiama", icon: Phone, href: phone ? `tel:${phone}` : undefined, disabled: !phone, disabledReason: "Numero di telefono non disponibile" },
    { label: "WhatsApp", icon: MessageCircle, href: whatsappHref(phone), external: true, disabled: !whatsappHref(phone), disabledReason: "Numero WhatsApp non disponibile" },
    { label: "Email", icon: Mail, href: email ? `mailto:${email}` : undefined, disabled: !email, disabledReason: "Indirizzo email non disponibile" },
    { label: "Nuova attività", icon: CalendarPlus, disabled: true, disabledReason: "La creazione di attività progetto resta disponibile nella scheda completa" },
  ];

  return (
    <UnifiedRecordPanel
      open
      onClose={onClose}
      eyebrow="Progetto"
      title={project?.name || "Dettaglio progetto"}
      subtitle={project?.company_name || "Cliente non collegato"}
      status={status}
      owner={project?.project_manager_email || "Non assegnato"}
      actions={actions}
      moreActions={[{ label: "Apri scheda completa", href: `/projects/${encodeURIComponent(recordId)}` }]}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      loading={loading}
      error={error}
    />
  );
}
