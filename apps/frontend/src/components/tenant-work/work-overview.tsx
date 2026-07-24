"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckSquare2,
  Clock3,
  FolderKanban,
  Gauge,
  ListChecks,
  UsersRound,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { calendarApi, type CalendarEvent } from "@/lib/tenant-calendar-api";
import { teamApi, type TeamMember, type TeamWorkloadItem } from "@/lib/tenant-team-api";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import {
  addLocalDays,
  dateValue,
  endOfWeek,
  formatShortDate,
  formatTime,
  getMetadataText,
  isSameLocalDay,
  projectIsActive,
  projectIsAtRisk,
  startOfLocalDay,
  startOfWeek,
  taskIsOpen,
  taskIsOverdue,
  type WorkListResponse,
  type WorkProject,
  type WorkTask,
} from "./work-model";
import {
  PriorityBadge,
  ProjectStatusBadge,
  TaskStatusBadge,
  WorkAvatar,
  WorkEmptyState,
  WorkKpiCard,
  WorkPageHeader,
  WorkProgress,
  WorkSection,
} from "./work-ui";

function memberFor(userId: string | null | undefined, members: TeamMember[]) {
  return members.find((member) => member.user_id === userId || member.id === userId);
}

function relatedProject(event: CalendarEvent, tasks: WorkTask[], projects: WorkProject[]) {
  if (event.source_entity_type === "project") return projects.find((project) => project.id === event.source_entity_id);
  if (event.source_entity_type === "task") {
    const task = tasks.find((item) => item.id === event.source_entity_id);
    return projects.find((project) => project.id === task?.project_id);
  }
  return undefined;
}

function deliveryGroup(value: string, now: Date) {
  const date = dateValue(value);
  if (!date) return "In programma";
  if (isSameLocalDay(date, now)) return "Oggi";
  if (isSameLocalDay(date, addLocalDays(now, 1))) return "Domani";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(date);
}

export function WorkOverview() {
  const { canView, canCreate } = useTenantAccess();
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [deadlines, setDeadlines] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [workload, setWorkload] = useState<TeamWorkloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const now = new Date();
      const results = await Promise.allSettled([
        apiFetch<WorkListResponse<WorkProject>>("/tenant/projects?limit=100"),
        apiFetch<WorkListResponse<WorkTask>>("/tenant/projects/tasks?limit=100"),
        canView("calendar")
          ? calendarApi.getCalendarDeadlines({
            start: startOfWeek(now).toISOString(),
            end: endOfWeek(addLocalDays(now, 7)).toISOString(),
            limit: 100,
          })
          : Promise.resolve({ items: [] }),
        canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] }),
        canView("team") ? teamApi.workload({ limit: 100 }) : Promise.resolve({ items: [] as TeamWorkloadItem[] }),
      ] as const);
      if (!active) return;
      if (results[0].status === "fulfilled") setProjects(results[0].value.items || []);
      if (results[1].status === "fulfilled") setTasks(results[1].value.items || []);
      if (results[2].status === "fulfilled") setDeadlines(results[2].value.items || []);
      if (results[3].status === "fulfilled") setMembers(results[3].value.items || []);
      if (results[4].status === "fulfilled") setWorkload(results[4].value.items || []);
      if (results.some((result) => result.status === "rejected")) {
        setError("Alcuni dati operativi non sono disponibili in questo momento.");
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [canView]);

  const now = new Date();
  const activeProjects = projects.filter(projectIsActive);
  const weekEnd = endOfWeek(now);
  const weekDeliveries = deadlines.filter((event) => {
    const date = dateValue(event.start_at);
    return date && date >= startOfLocalDay(now) && date <= weekEnd;
  });
  const overdueTasks = tasks.filter((task) => taskIsOverdue(task, now));
  const workloadAverage = workload.length
    ? Math.round(workload.reduce((total, item) => total + Number(item.utilizationPercent || 0), 0) / workload.length)
    : null;

  const priorityProjects = useMemo(() => [...activeProjects]
    .sort((a, b) => {
      const risk = Number(projectIsAtRisk(b, now)) - Number(projectIsAtRisk(a, now));
      if (risk) return risk;
      const aDue = dateValue(a.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = dateValue(b.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue || Number(b.progress || 0) - Number(a.progress || 0);
    })
    .slice(0, 5), [activeProjects, now]);

  const upcoming = useMemo(() => deadlines
    .filter((event) => {
      const date = dateValue(event.start_at);
      return date && date >= startOfLocalDay(now);
    })
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 6), [deadlines, now]);

  const todayPriorities = useMemo(() => tasks
    .filter((task) => {
      const due = dateValue(task.due_at);
      return taskIsOpen(task) && due && due < addLocalDays(startOfLocalDay(now), 1);
    })
    .sort((a, b) => {
      const overdue = Number(taskIsOverdue(b, now)) - Number(taskIsOverdue(a, now));
      return overdue || (dateValue(a.due_at)?.getTime() || 0) - (dateValue(b.due_at)?.getTime() || 0);
    })
    .slice(0, 5), [tasks, now]);

  const groupedDeliveries = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    upcoming.forEach((event) => {
      const key = deliveryGroup(event.start_at, now);
      groups.set(key, [...(groups.get(key) || []), event]);
    });
    return Array.from(groups.entries());
  }, [upcoming, now]);

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <WorkPageHeader
        title="Lavoro"
        description="Progetti, attività e consegne sotto controllo in un’unica vista."
        ctaLabel="Nuovo progetto"
        ctaHref="/projects/new"
        canCreate={canCreate("projects")}
      />

      {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <WorkKpiCard icon={FolderKanban} label="Progetti attivi" value={loading ? "…" : activeProjects.length} hint="Progetti non ancora consegnati o chiusi" />
        <WorkKpiCard icon={CalendarDays} label="Consegne questa settimana" value={loading ? "…" : weekDeliveries.length} hint="Scadenze reali presenti nel calendario" tone="green" />
        <WorkKpiCard icon={Clock3} label="Attività in ritardo" value={loading ? "…" : overdueTasks.length} hint="Task aperti oltre la scadenza" tone="orange" />
        <WorkKpiCard
          icon={UsersRound}
          label="Carico del team"
          value={loading ? "…" : workloadAverage === null ? "—" : `${workloadAverage}%`}
          hint={workloadAverage === null ? "Il carico è visibile con accesso ai dati Team" : "Utilizzo medio sulle capacità disponibili"}
          tone="blue"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <WorkSection title="Avanzamento progetti" actionHref="/projects" actionLabel="Vedi tutti i progetti">
          {priorityProjects.length ? (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {priorityProjects.map((project) => {
                const manager = memberFor(project.project_manager_id, members);
                return (
                  <Link key={project.id} href={`/projects/${project.id}`} className="grid gap-3 px-3 py-3.5 transition-colors hover:bg-slate-50 sm:grid-cols-[minmax(170px,1.2fr)_minmax(180px,1.5fr)_75px_42px_110px] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{project.name}</p>
                      <p className="truncate text-xs text-slate-500">{project.company_name || "Cliente non collegato"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <WorkProgress value={project.progress} danger={projectIsAtRisk(project, now)} className="flex-1" />
                      <span className="w-9 text-right text-xs font-semibold text-slate-700">{Math.round(Number(project.progress || 0))}%</span>
                    </div>
                    <span className="text-xs text-slate-500">{formatShortDate(project.due_date)}</span>
                    <WorkAvatar name={manager?.display_name} email={manager?.email || project.project_manager_email} size="sm" />
                    <ProjectStatusBadge value={project.status} />
                  </Link>
                );
              })}
            </div>
          ) : <WorkEmptyState>Nessun progetto attivo disponibile.</WorkEmptyState>}
        </WorkSection>

        <WorkSection title="Prossime consegne">
          {groupedDeliveries.length ? (
            <div className="space-y-4">
              {groupedDeliveries.map(([group, events]) => (
                <div key={group}>
                  <p className="mb-2 text-xs font-semibold text-indigo-600">{group}</p>
                  <div className="space-y-2 border-l border-slate-200 pl-4">
                    {events.map((event) => {
                      const project = relatedProject(event, tasks, projects);
                      const assignee = memberFor(event.assigned_to_user_id, members);
                      return (
                        <Link key={event.id} href={`/calendar/events/${event.id}`} className="relative flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 hover:bg-slate-50">
                          <span className="absolute -left-[21px] h-2.5 w-2.5 rounded-full bg-indigo-600 ring-4 ring-white" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{event.title}</p>
                            <p className="truncate text-xs text-slate-500">{project?.name || getMetadataText(event.metadata, "project_name", "company_name") || "Calendario"}</p>
                          </div>
                          {event.priority ? <PriorityBadge value={event.priority} /> : null}
                          <WorkAvatar name={assignee?.display_name} email={assignee?.email} size="sm" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : <WorkEmptyState>Nessuna consegna imminente disponibile.</WorkEmptyState>}
        </WorkSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <WorkSection title="Priorità di oggi">
          {todayPriorities.length ? (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {todayPriorities.map((task) => {
                const assignee = memberFor(task.assignee_id, members);
                return (
                  <div key={task.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500">
                      {task.milestone_id ? <ListChecks className="h-4 w-4 text-indigo-600" /> : <CheckSquare2 className="h-4 w-4" />}
                    </span>
                    <div className="min-w-[180px] flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
                      <p className="truncate text-xs text-slate-500">{task.project_name || "Progetto non collegato"}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{formatTime(task.due_at)}</span>
                    <WorkAvatar name={assignee?.display_name} email={assignee?.email || task.assignee_email} size="sm" />
                    <TaskStatusBadge value={task.status} />
                    <Link href={`/projects/${task.project_id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Apri</Link>
                  </div>
                );
              })}
            </div>
          ) : <WorkEmptyState>Nessuna attività in scadenza oggi.</WorkEmptyState>}
        </WorkSection>

        <WorkSection title="Carico del team">
          {workload.length ? (
            <div className="space-y-4">
              {workload.slice(0, 6).map((item) => {
                const utilization = Math.max(0, Math.round(Number(item.utilizationPercent || 0)));
                const overloaded = Boolean(item.isOverloaded) || utilization > 100;
                const label = overloaded ? "Sovraccarico" : utilization >= 80 ? "Carico" : "Disponibile";
                return (
                  <div key={item.team_member_id} className="grid grid-cols-[36px_minmax(80px,1fr)_minmax(100px,1.5fr)_44px] items-center gap-3">
                    <WorkAvatar name={item.display_name} email={item.email} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{item.display_name}</p>
                      <p className={overloaded ? "text-[11px] text-rose-600" : "text-[11px] text-slate-500"}>{label}</p>
                    </div>
                    <WorkProgress value={utilization} danger={overloaded} />
                    <span className="text-right text-xs font-semibold text-slate-700">{utilization}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <WorkEmptyState>
              <span className="inline-flex items-center gap-2"><Gauge className="h-4 w-4" /> Nessun dato di capacità disponibile.</span>
            </WorkEmptyState>
          )}
        </WorkSection>
      </div>
    </main>
  );
}
