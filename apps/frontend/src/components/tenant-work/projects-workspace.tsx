"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileText,
  FolderKanban,
  Search,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { listDocumentsForEntity } from "@/lib/tenant-documents-api";
import { teamApi, type TeamMember } from "@/lib/tenant-team-api";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PROJECT_STATUSES,
  addLocalDays,
  dateValue,
  formatShortDate,
  optionLabel,
  projectIsActive,
  projectIsAtRisk,
  startOfLocalDay,
  type WorkListResponse,
  type WorkMilestone,
  type WorkProject,
  type WorkTask,
} from "./work-model";
import {
  ProjectStatusBadge,
  WorkAvatar,
  WorkEmptyState,
  WorkKpiCard,
  WorkPageHeader,
  WorkProgress,
} from "./work-ui";

type ProjectFile = { id: string };

function memberFor(project: WorkProject, members: TeamMember[]) {
  return members.find((member) => member.user_id === project.project_manager_id || member.id === project.project_manager_id);
}

export function ProjectsWorkspace() {
  const { canView, canCreate } = useTenantAccess();
  const [items, setItems] = useState<WorkProject[]>([]);
  const [allProjects, setAllProjects] = useState<WorkProject[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [manager, setManager] = useState("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedProject, setSelectedProject] = useState<WorkProject | null>(null);
  const [milestones, setMilestones] = useState<WorkMilestone[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 8;

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiFetch<WorkListResponse<WorkProject>>("/tenant/projects?limit=100"),
      canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] as TeamMember[] }),
    ] as const).then((results) => {
      if (!active) return;
      if (results[0].status === "fulfilled") setAllProjects(results[0].value.items || []);
      if (results[1].status === "fulfilled") setMembers(results[1].value.items || []);
    });
    return () => {
      active = false;
    };
  }, [canView]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: String(limit), offset: String((page - 1) * limit) });
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      if (manager !== "all") params.set("project_manager_id", manager);
      try {
        const data = await apiFetch<WorkListResponse<WorkProject>>(`/tenant/projects?${params.toString()}`);
        if (!active) return;
        setItems(data.items || []);
        setTotal(Number(data.total || 0));
        setSelectedId((current) => current && data.items.some((item) => item.id === current) ? current : data.items[0]?.id);
      } catch (reason) {
        if (!active) return;
        setItems([]);
        setTotal(0);
        setError(reason instanceof Error ? reason.message : "Caricamento progetti non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [manager, page, search, status]);

  useEffect(() => {
    let active = true;
    if (!selectedId) {
      setSelectedProject(null);
      setMilestones([]);
      setTasks([]);
      setFiles([]);
      setDocumentCount(0);
      return;
    }
    setDetailLoading(true);
    Promise.allSettled([
      apiFetch<WorkProject>(`/tenant/projects/${selectedId}`),
      apiFetch<WorkListResponse<WorkMilestone>>(`/tenant/projects/${selectedId}/milestones`),
      apiFetch<WorkListResponse<WorkTask>>(`/tenant/projects/${selectedId}/tasks?limit=100`),
      apiFetch<WorkListResponse<ProjectFile>>(`/tenant/projects/${selectedId}/files`),
      canView("documents")
        ? listDocumentsForEntity("project", selectedId, { limit: 100 })
        : Promise.resolve({ items: [], total: 0 }),
    ] as const).then((results) => {
      if (!active) return;
      setSelectedProject(results[0].status === "fulfilled" ? results[0].value : items.find((item) => item.id === selectedId) || null);
      setMilestones(results[1].status === "fulfilled" ? results[1].value.items || [] : []);
      setTasks(results[2].status === "fulfilled" ? results[2].value.items || [] : []);
      setFiles(results[3].status === "fulfilled" ? results[3].value.items || [] : []);
      setDocumentCount(results[4].status === "fulfilled" ? Number(results[4].value.total ?? results[4].value.items?.length ?? 0) : 0);
      setDetailLoading(false);
    });
    return () => {
      active = false;
    };
  }, [canView, items, selectedId]);

  const now = new Date();
  const activeCount = allProjects.filter(projectIsActive).length;
  const deliveryCount = allProjects.filter((project) => {
    const due = dateValue(project.due_date);
    return projectIsActive(project) && due && due >= startOfLocalDay(now) && due <= addLocalDays(startOfLocalDay(now), 7);
  }).length;
  const riskCount = allProjects.filter((project) => projectIsAtRisk(project, now)).length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const managers = useMemo(() => {
    const byId = new Map<string, { id: string; label: string }>();
    members.forEach((member) => {
      if (member.user_id) byId.set(member.user_id, { id: member.user_id, label: member.display_name || member.email });
    });
    allProjects.forEach((project) => {
      if (project.project_manager_id) {
        byId.set(project.project_manager_id, {
          id: project.project_manager_id,
          label: memberFor(project, members)?.display_name || project.project_manager_email || "Responsabile",
        });
      }
    });
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allProjects, members]);

  const nextMilestone = useMemo(() => milestones
    .filter((milestone) => !["completed", "skipped"].includes(String(milestone.status || "")))
    .sort((a, b) => (dateValue(a.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (dateValue(b.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER))[0], [milestones]);
  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const detailManager = selectedProject ? memberFor(selectedProject, members) : undefined;

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <WorkPageHeader
        title="Progetti"
        description="Segui avanzamento, responsabili e prossime consegne."
        ctaLabel="Nuovo progetto"
        ctaHref="/projects/new"
        canCreate={canCreate("projects")}
      />

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="h-12 rounded-xl border-slate-200 bg-white pl-11"
            placeholder="Cerca progetto o cliente..."
          />
        </div>
        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
          <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white lg:w-44"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {PROJECT_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={manager} onValueChange={(value) => { setManager(value); setPage(1); }}>
          <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white lg:w-52"><SelectValue placeholder="Responsabile" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i responsabili</SelectItem>
            {managers.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <WorkKpiCard icon={FolderKanban} label="Attivi" value={loading ? "…" : activeCount} hint="Progetti non ancora consegnati o chiusi" />
        <WorkKpiCard icon={Clock3} label="In consegna" value={loading ? "…" : deliveryCount} hint="Scadenza nei prossimi 7 giorni" tone="orange" />
        <WorkKpiCard icon={AlertTriangle} label="A rischio" value={loading ? "…" : riskCount} hint="Bloccati, urgenti o oltre scadenza" tone="red" />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center text-sm text-slate-500">Caricamento progetti…</div>
          ) : items.length === 0 ? (
            <div className="p-5"><WorkEmptyState>Nessun progetto corrisponde ai filtri selezionati.</WorkEmptyState></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Progetto</th>
                    <th className="px-4 py-4">Cliente</th>
                    <th className="px-4 py-4">Responsabile</th>
                    <th className="px-4 py-4">Fase</th>
                    <th className="px-4 py-4">Avanzamento</th>
                    <th className="px-4 py-4">Prossima consegna</th>
                    <th className="px-4 py-4">Stato</th>
                    <th className="w-12 px-3 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((project) => {
                    const owner = memberFor(project, members);
                    const selected = selectedId === project.id;
                    return (
                      <tr
                        key={project.id}
                        onClick={() => setSelectedId(project.id)}
                        className={selected ? "cursor-pointer bg-indigo-50/65" : "cursor-pointer hover:bg-slate-50"}
                      >
                        <td className="px-5 py-4">
                          <Link href={`/projects/${project.id}`} onClick={(event) => event.stopPropagation()} className="font-semibold text-indigo-600 hover:text-indigo-700">
                            {project.name}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{project.company_name || "—"}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <WorkAvatar name={owner?.display_name} email={owner?.email || project.project_manager_email} size="sm" />
                            <span className="max-w-28 truncate text-slate-700">{owner?.display_name || project.project_manager_email || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{project.current_phase || optionLabel(PROJECT_STATUSES, project.status)}</td>
                        <td className="px-4 py-4">
                          <div className="flex min-w-32 items-center gap-2">
                            <div className="w-24"><WorkProgress value={project.progress} danger={projectIsAtRisk(project, now)} /></div>
                            <span className="text-xs font-semibold text-slate-700">{Math.round(Number(project.progress || 0))}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-2 text-slate-600"><CalendarDays className="h-4 w-4" /> {formatShortDate(project.due_date)}</span>
                        </td>
                        <td className="px-4 py-4"><ProjectStatusBadge value={project.status} /></td>
                        <td className="px-3 py-4 text-slate-400"><ChevronRight className="h-4 w-4" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <footer className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} di ${total} progetti` : "Nessun progetto"}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <span className="min-w-9 rounded-lg border border-slate-200 px-3 py-2 text-center font-semibold text-slate-700">{page}</span>
              <button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </footer>
        </section>

        <aside className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 xl:sticky xl:top-5 xl:self-start">
          {!selectedProject ? (
            <WorkEmptyState>Seleziona un progetto per visualizzarne i dettagli.</WorkEmptyState>
          ) : (
            <div className={detailLoading ? "opacity-60" : ""}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950">{selectedProject.name}</h2>
                <button type="button" onClick={() => setSelectedId(undefined)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Chiudi dettaglio"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-6 space-y-5">
                {selectedProject.company_name ? (
                  <div className="flex gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><FolderKanban className="h-4 w-4" /></span>
                    <div><p className="text-xs text-slate-500">Cliente</p><p className="mt-0.5 text-sm font-medium text-slate-800">{selectedProject.company_name}</p></div>
                  </div>
                ) : null}
                {(detailManager || selectedProject.project_manager_email) ? (
                  <div className="flex gap-3">
                    <WorkAvatar name={detailManager?.display_name} email={detailManager?.email || selectedProject.project_manager_email} />
                    <div><p className="text-xs text-slate-500">Responsabile</p><p className="mt-0.5 text-sm font-medium text-slate-800">{detailManager?.display_name || selectedProject.project_manager_email}</p></div>
                  </div>
                ) : null}
                <div className="border-y border-slate-100 py-5">
                  <p className="text-xs text-slate-500">Fase</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{selectedProject.current_phase || optionLabel(PROJECT_STATUSES, selectedProject.status)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Avanzamento complessivo</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{Math.round(Number(selectedProject.progress || 0))}%</p>
                  <WorkProgress value={selectedProject.progress} danger={projectIsAtRisk(selectedProject, now)} className="mt-3" />
                </div>
                {nextMilestone ? (
                  <div className="border-t border-slate-100 pt-5">
                    <p className="text-xs text-slate-500">Prossima milestone</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-800">{nextMilestone.title}</p>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> {formatShortDate(nextMilestone.due_date)}</span>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-3 border-y border-slate-100 py-5">
                  <div className="flex items-center justify-between text-sm"><span className="inline-flex items-center gap-2 text-slate-600"><ClipboardCheck className="h-4 w-4" /> Attività aperte</span><strong className="text-indigo-600">{openTasks}</strong></div>
                  <div className="flex items-center justify-between text-sm"><span className="inline-flex items-center gap-2 text-slate-600"><FileText className="h-4 w-4" /> Documenti</span><strong className="text-indigo-600">{Math.max(documentCount, files.length)}</strong></div>
                </div>
                <Link href={`/projects/${selectedProject.id}`} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">
                  Apri progetto <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </aside>
      </div>
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-slate-500" aria-label="Viste specialistiche progetti">
        <span>Viste specialistiche:</span>
        <Link href="/projects/kanban" className="font-medium text-indigo-600 hover:text-indigo-700">Kanban</Link>
        <Link href="/projects/timeline" className="font-medium text-indigo-600 hover:text-indigo-700">Timeline</Link>
        <Link href="/projects/milestones" className="font-medium text-indigo-600 hover:text-indigo-700">Milestone</Link>
        <Link href="/projects/files" className="font-medium text-indigo-600 hover:text-indigo-700">File</Link>
      </nav>
    </main>
  );
}
