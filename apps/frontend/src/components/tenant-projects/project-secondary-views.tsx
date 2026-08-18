"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, FileText, Search, SortAsc } from "lucide-react";
import { DoflowProjectRecordPanel } from "@/components/doflow-record-panel/project-record-panel";
import { useUnifiedRecordPanelUrl } from "@/components/doflow-record-panel/unified-record-panel";
import { WorkEmptyState, WorkPageHeader } from "@/components/tenant-work/work-ui";
import { PRIORITIES, TASK_STATUSES, taskIsOverdue, type WorkListResponse, type WorkProject, type WorkTask } from "@/components/tenant-work/work-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { apiFetch } from "@/lib/api";
import { getDoFlowUser } from "@/lib/jwt";
import { DOFLOW_PROJECT_STAGE_OPTIONS, projectStageLabel } from "@/lib/project-stage-model";
import { downloadDocumentBlob, listDocuments, type TenantDocument } from "@/lib/tenant-documents-api";
import { teamApi, type TeamMember } from "@/lib/tenant-team-api";
import { categoryLabel, formatBytes, formatDateTime } from "@/components/tenant-documents/document-utils";

type TimelineItem = {
  id: string;
  project_id: string;
  project_name: string;
  company_name?: string | null;
  project_status?: string | null;
  type: string;
  author_user_id?: string | null;
  author_label?: string | null;
  created_at: string;
  title: string;
  status?: string | null;
};

const timelineTypes = [
  ["activity", "Attività"], ["appointment", "Appuntamento"], ["call", "Chiamata"],
  ["email", "Email"], ["file", "File"], ["note", "Nota"], ["status_change", "Cambio fase"], ["whatsapp", "WhatsApp"],
] as const;

function queryValue(name: string, fallback = "all") {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

function syncQuery(values: Record<string, string>) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  Object.entries(values).forEach(([key, value]) => {
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
  });
  const query = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function useSecondaryContext() {
  const { canView } = useTenantAccess();
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiFetch<WorkListResponse<WorkProject>>("/tenant/projects?limit=100"),
      canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] as TeamMember[] }),
    ]).then(([projectResult, memberResult]) => {
      if (!active) return;
      if (projectResult.status === "fulfilled") setProjects(projectResult.value.items || []);
      if (memberResult.status === "fulfilled") setMembers(memberResult.value.items || []);
    });
    return () => { active = false; };
  }, [canView]);
  return { projects, members };
}

function ProjectPanel({ projectId, projects, activeTab, setActiveTab, close }: {
  projectId: string | null;
  projects: WorkProject[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  close: () => void;
}) {
  if (!projectId) return null;
  return <DoflowProjectRecordPanel recordId={projectId} fallbackProject={projects.find((item) => item.id === projectId)} activeTab={activeTab} onTabChange={setActiveTab} onClose={close} />;
}

function FiltersBox({ children }: { children: ReactNode }) {
  return <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">{children}</section>;
}

function ProjectButton({ id, name, onOpen }: { id: string; name: string; onOpen: (id: string, trigger: HTMLElement) => void }) {
  return <button type="button" data-record-sensitive className="text-left font-semibold text-indigo-600 hover:text-indigo-700" onClick={(event) => onOpen(id, event.currentTarget)}>{name}</button>;
}

export function DoflowProjectsTimelineView() {
  const { projects, members } = useSecondaryContext();
  const panel = useUnifiedRecordPanelUrl({ enabled: true, paramKey: "project", tabs: ["overview", "activity", "files", "administration"], defaultTab: "overview" });
  const [search, setSearch] = useState(() => queryValue("search", ""));
  const [project, setProject] = useState(() => queryValue("project_id"));
  const [stage, setStage] = useState(() => queryValue("stage"));
  const [operator, setOperator] = useState(() => queryValue("operator_id"));
  const [type, setType] = useState(() => queryValue("type"));
  const [dateFrom, setDateFrom] = useState(() => queryValue("date_from", ""));
  const [dateTo, setDateTo] = useState(() => queryValue("date_to", ""));
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncQuery({ search, project_id: project, stage, operator_id: operator, type, date_from: dateFrom, date_to: dateTo });
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (project !== "all") params.set("project_id", project);
      if (stage !== "all") params.set("stage", stage);
      if (operator !== "all") params.set("operator_id", operator);
      if (type !== "all") params.set("types", type);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", `${dateTo}T23:59:59.999Z`);
      setLoading(true); setError(null);
      apiFetch<WorkListResponse<TimelineItem>>(`/tenant/timeline/projects?${params.toString()}`)
        .then((data) => setItems(data.items || []))
        .catch((reason) => { setItems([]); setError(reason instanceof Error ? reason.message : "Timeline non disponibile."); })
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [dateFrom, dateTo, operator, project, search, stage, type]);

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <WorkPageHeader title="Flusso progetti" description="Eventi reali di progetto, consultabili senza lasciare la vista corrente." />
    <FiltersBox>
      <div className="relative sm:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Cerca eventi" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 pl-10" placeholder="Cerca progetto, cliente o evento…" /></div>
      <Select value={project} onValueChange={setProject}><SelectTrigger><SelectValue placeholder="Progetto" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i progetti</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select value={stage} onValueChange={setStage}><SelectTrigger><SelectValue placeholder="Fase" /></SelectTrigger><SelectContent><SelectItem value="all">Tutte le fasi</SelectItem>{DOFLOW_PROJECT_STAGE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
      <Select value={operator} onValueChange={setOperator}><SelectTrigger><SelectValue placeholder="Operatore" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli operatori</SelectItem>{members.filter((item) => item.user_id).map((item) => <SelectItem key={item.id} value={String(item.user_id)}>{item.display_name}</SelectItem>)}</SelectContent></Select>
      <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i tipi</SelectItem>{timelineTypes.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      <Input aria-label="Data iniziale" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
      <Input aria-label="Data finale" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
    </FiltersBox>
    {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</p> : null}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {loading ? <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">Caricamento flusso…</div> : items.length === 0 ? <div className="p-5"><WorkEmptyState>Nessun evento corrisponde ai filtri selezionati.</WorkEmptyState></div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500"><tr><th className="px-5 py-4">Progetto</th><th className="px-4 py-4">Cliente</th><th className="px-4 py-4">Fase</th><th className="px-4 py-4">Evento</th><th className="px-4 py-4">Autore</th><th className="px-4 py-4">Data</th><th className="px-4 py-4">Tipo</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4"><ProjectButton id={item.project_id} name={item.project_name} onOpen={panel.openRecord} /></td><td className="px-4 py-4" data-record-sensitive>{item.company_name || "—"}</td><td className="px-4 py-4">{projectStageLabel(item.project_status, true)}</td><td className="px-4 py-4 font-medium text-slate-800">{item.title}</td><td className="px-4 py-4" data-record-sensitive>{item.author_label || "Sistema"}</td><td className="px-4 py-4 whitespace-nowrap">{formatDate(item.created_at)}</td><td className="px-4 py-4"><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{timelineTypes.find(([value]) => value === item.type)?.[1] || item.type}</span></td></tr>)}</tbody></table></div>}
    </section>
    <ProjectPanel projectId={panel.recordId} projects={projects} activeTab={panel.activeTab} setActiveTab={panel.setActiveTab} close={panel.closeRecord} />
  </main>;
}

export function DoflowProjectsTasksView() {
  const { canUpdate } = useTenantAccess();
  const { projects, members } = useSecondaryContext();
  const panel = useUnifiedRecordPanelUrl({ enabled: true, paramKey: "project", tabs: ["overview", "activity", "files", "administration"], defaultTab: "overview" });
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  const canAssign = ["owner", "admin", "manager", "superadmin", "super_admin"].includes(role);
  const [search, setSearch] = useState(() => queryValue("search", ""));
  const [project, setProject] = useState(() => queryValue("project_id"));
  const [status, setStatus] = useState(() => queryValue("status"));
  const [priority, setPriority] = useState(() => queryValue("priority"));
  const [assignee, setAssignee] = useState(() => queryValue("assignee_id"));
  const [sortBy, setSortBy] = useState(() => queryValue("sortBy", "due_at"));
  const [sortOrder, setSortOrder] = useState(() => queryValue("sortOrder", "asc"));
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const params = new URLSearchParams({ limit: "100", sortBy, sortOrder });
    if (search.trim()) params.set("search", search.trim());
    if (project !== "all") params.set("project_id", project);
    if (status !== "all") params.set("status", status);
    if (priority !== "all") params.set("priority", priority);
    if (assignee !== "all") params.set("assignee_id", assignee);
    setLoading(true); setError(null);
    return apiFetch<WorkListResponse<WorkTask>>(`/tenant/projects/tasks?${params.toString()}`)
      .then((data) => setTasks(data.items || []))
      .catch((reason) => { setTasks([]); setError(reason instanceof Error ? reason.message : "Attività non disponibili."); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    syncQuery({ search, project_id: project, status, priority, assignee_id: assignee, sortBy, sortOrder });
    const timer = window.setTimeout(() => { void load(); }, 250);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignee, priority, project, search, sortBy, sortOrder, status]);

  const patch = async (task: WorkTask, body: Record<string, unknown>, path = "") => {
    setSavingId(task.id); setError(null);
    try { await apiFetch(`/tenant/projects/${task.project_id}/tasks/${task.id}${path}`, { method: "PATCH", body: JSON.stringify(body) }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito."); }
    finally { setSavingId(null); }
  };

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <WorkPageHeader title="Attività progetti" description="Task reali, responsabilità e scadenze in una vista globale operativa." />
    <FiltersBox>
      <div className="relative sm:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Cerca task" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 pl-10" placeholder="Cerca titolo, descrizione o progetto…" /></div>
      <Select value={project} onValueChange={setProject}><SelectTrigger><SelectValue placeholder="Progetto" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i progetti</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select value={assignee} onValueChange={setAssignee}><SelectTrigger><SelectValue placeholder="Responsabile" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i responsabili</SelectItem>{members.filter((item) => item.user_id).map((item) => <SelectItem key={item.id} value={String(item.user_id)}>{item.display_name}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem>{TASK_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue placeholder="Priorità" /></SelectTrigger><SelectContent><SelectItem value="all">Tutte le priorità</SelectItem>{PRIORITIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger><SortAsc className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="due_at">Scadenza</SelectItem><SelectItem value="priority">Priorità</SelectItem><SelectItem value="status">Stato</SelectItem><SelectItem value="updated_at">Ultimo aggiornamento</SelectItem></SelectContent></Select>
      <Select value={sortOrder} onValueChange={setSortOrder}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asc">Crescente</SelectItem><SelectItem value="desc">Decrescente</SelectItem></SelectContent></Select>
    </FiltersBox>
    {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</p> : null}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{loading ? <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">Caricamento attività…</div> : tasks.length === 0 ? <div className="p-5"><WorkEmptyState>Nessun task corrisponde ai filtri selezionati.</WorkEmptyState></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm"><thead className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500"><tr><th className="px-5 py-4">Titolo</th><th className="px-4 py-4">Progetto</th><th className="px-4 py-4">Cliente</th><th className="px-4 py-4">Responsabile</th><th className="px-4 py-4">Stato</th><th className="px-4 py-4">Priorità</th><th className="px-4 py-4">Scadenza</th></tr></thead><tbody className="divide-y divide-slate-100">{tasks.map((task) => { const overdue = taskIsOverdue(task); const disabled = savingId === task.id; return <tr key={task.id} className={overdue ? "bg-rose-50/40" : "hover:bg-slate-50"}><td className="px-5 py-4 font-semibold text-slate-900">{task.title}</td><td className="px-4 py-4"><ProjectButton id={task.project_id} name={task.project_name || "Progetto"} onOpen={panel.openRecord} /></td><td className="px-4 py-4" data-record-sensitive>{task.company_name || "—"}</td><td className="px-4 py-4">{canAssign ? <Select value={task.assignee_id || "none"} disabled={disabled} onValueChange={(value) => void patch(task, { assignee_id: value === "none" ? null : value }, "/assign")}><SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Non assegnato</SelectItem>{members.filter((item) => item.user_id).map((item) => <SelectItem key={item.id} value={String(item.user_id)}>{item.display_name}</SelectItem>)}</SelectContent></Select> : <span data-record-sensitive>{task.assignee_label || "Non assegnato"}</span>}</td><td className="px-4 py-4">{canUpdate("projects") ? <Select value={task.status || "backlog"} disabled={disabled} onValueChange={(value) => void patch(task, { status: value }, "/status")}><SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger><SelectContent>{TASK_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select> : TASK_STATUSES.find(([value]) => value === task.status)?.[1] || task.status}</td><td className="px-4 py-4">{PRIORITIES.find(([value]) => value === task.priority)?.[1] || task.priority}</td><td className={overdue ? "px-4 py-4 font-semibold text-rose-700" : "px-4 py-4 text-slate-600"}>{formatDate(task.due_at)}{overdue ? <span className="ml-2 rounded-full bg-rose-100 px-2 py-1 text-[11px]">Scaduta</span> : null}</td></tr>; })}</tbody></table></div>}</section>
    <ProjectPanel projectId={panel.recordId} projects={projects} activeTab={panel.activeTab} setActiveTab={panel.setActiveTab} close={panel.closeRecord} />
  </main>;
}

export function DoflowProjectsFilesView() {
  const { projects, members } = useSecondaryContext();
  const panel = useUnifiedRecordPanelUrl({ enabled: true, paramKey: "project", tabs: ["overview", "activity", "files", "administration"], defaultTab: "overview" });
  const [search, setSearch] = useState(() => queryValue("search", ""));
  const [project, setProject] = useState(() => queryValue("project_id"));
  const [category, setCategory] = useState(() => queryValue("category"));
  const [status, setStatus] = useState(() => queryValue("status", "active"));
  const [author, setAuthor] = useState(() => queryValue("uploaded_by"));
  const [dateFrom, setDateFrom] = useState(() => queryValue("date_from", ""));
  const [dateTo, setDateTo] = useState(() => queryValue("date_to", ""));
  const [items, setItems] = useState<TenantDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncQuery({ search, project_id: project, category, status, uploaded_by: author, date_from: dateFrom, date_to: dateTo });
    const timer = window.setTimeout(() => {
      setLoading(true); setError(null);
      listDocuments({ entity_type: "project", search: search.trim(), entity_id: project === "all" ? undefined : project, category: category === "all" ? undefined : category, status, date_from: dateFrom || undefined, date_to: dateTo ? `${dateTo}T23:59:59.999Z` : undefined, limit: 100 })
        .then((data) => setItems((data.items || []).filter((item) => author === "all" || item.uploaded_by === author)))
        .catch((reason) => { setItems([]); setError(reason instanceof Error ? reason.message : "File non disponibili."); })
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [author, category, dateFrom, dateTo, project, search, status]);

  const download = async (document: TenantDocument) => {
    try {
      const result = await downloadDocumentBlob(document);
      const url = URL.createObjectURL(result.blob);
      const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Download non riuscito."); }
  };
  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category).filter(Boolean))), [items]);

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <WorkPageHeader title="File progetti" description="Documenti reali collegati ai progetti, ricercabili e scaricabili in sicurezza." />
    <FiltersBox>
      <div className="relative sm:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Cerca file" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 pl-10" placeholder="Cerca nome o descrizione…" /></div>
      <Select value={project} onValueChange={setProject}><SelectTrigger><SelectValue placeholder="Progetto" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i progetti</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select value={author} onValueChange={setAuthor}><SelectTrigger><SelectValue placeholder="Autore" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli autori</SelectItem>{members.filter((item) => item.user_id).map((item) => <SelectItem key={item.id} value={String(item.user_id)}>{item.display_name}</SelectItem>)}</SelectContent></Select>
      <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="all">Tutte le categorie</SelectItem>{categories.map((item) => <SelectItem key={item} value={item}>{categoryLabel(item)}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem><SelectItem value="active">Attivo</SelectItem><SelectItem value="archived">Archiviato</SelectItem></SelectContent></Select>
      <Input aria-label="Data iniziale file" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
      <Input aria-label="Data finale file" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
    </FiltersBox>
    {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</p> : null}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{loading ? <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">Caricamento file…</div> : items.length === 0 ? <div className="p-5"><WorkEmptyState>Nessun file progetto corrisponde ai filtri selezionati.</WorkEmptyState></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm"><thead className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500"><tr><th className="px-5 py-4">Nome</th><th className="px-4 py-4">Progetto</th><th className="px-4 py-4">Cliente</th><th className="px-4 py-4">Categoria</th><th className="px-4 py-4">Stato</th><th className="px-4 py-4">Versione</th><th className="px-4 py-4">Dimensione</th><th className="px-4 py-4">Data</th><th className="px-4 py-4">Autore</th><th className="px-3 py-4" /></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><FileText className="h-4 w-4" /></span><span className="max-w-56 truncate font-semibold text-slate-900" title={item.original_filename}>{item.title || item.original_filename}</span></div></td><td className="px-4 py-4">{item.entity_id && item.project_name ? <ProjectButton id={item.entity_id} name={item.project_name} onOpen={panel.openRecord} /> : "—"}</td><td className="px-4 py-4" data-record-sensitive>{item.company_name || "—"}</td><td className="px-4 py-4">{categoryLabel(item.category)}</td><td className="px-4 py-4">{item.status === "active" ? "Attivo" : item.status === "archived" ? "Archiviato" : item.status}</td><td className="px-4 py-4">v{item.version_number || 1}</td><td className="px-4 py-4">{formatBytes(item.size_bytes)}</td><td className="px-4 py-4 whitespace-nowrap">{formatDateTime(item.created_at)}</td><td className="px-4 py-4" data-record-sensitive>{item.uploaded_by_label || "Sistema"}</td><td className="px-3 py-4"><Button type="button" size="sm" variant="outline" onClick={() => void download(item)} aria-label={`Scarica ${item.title || item.original_filename}`}><Download className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div>}</section>
    <ProjectPanel projectId={panel.recordId} projects={projects} activeTab={panel.activeTab} setActiveTab={panel.setActiveTab} close={panel.closeRecord} />
  </main>;
}
