"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  Flag,
  List,
  UsersRound,
} from "lucide-react";
import { calendarApi, type CalendarEvent } from "@/lib/tenant-calendar-api";
import { apiFetch } from "@/lib/api";
import { teamApi, type TeamMember } from "@/lib/tenant-team-api";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  addLocalDays,
  dateValue,
  formatShortDate,
  getMetadataText,
  isSameLocalDay,
  startOfLocalDay,
  startOfWeek,
  type WorkListResponse,
  type WorkMilestone,
  type WorkProject,
  type WorkTask,
} from "./work-model";
import { calendarTone, calendarToneClasses, calendarTypeLabel } from "./calendar-presentation";
import { CalendarWeekGrid } from "./calendar-week-grid";
import { CalendarMonthGrid } from "./calendar-month-grid";
import { WorkAvatar, WorkEmptyState, WorkPageHeader } from "./work-ui";

type CalendarView = "week" | "month";
type ProjectMilestone = WorkMilestone & { project_id: string };

function monthRange(date: Date) {
  const start = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
  const end = addLocalDays(start, 42);
  return { start, end };
}

function dateRangeLabel(view: CalendarView, cursor: Date) {
  if (view === "month") {
    return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(cursor);
  }
  const start = startOfWeek(cursor);
  const end = addLocalDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(end)}`;
  }
  return `${formatShortDate(start)} – ${new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(end)}`;
}

function deadlineGroup(event: CalendarEvent, now: Date) {
  const date = dateValue(event.start_at);
  if (!date) return "In programma";
  if (isSameLocalDay(date, now)) return "Oggi";
  if (isSameLocalDay(date, addLocalDays(now, 1))) return "Domani";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(date);
}

export function CalendarWorkspace() {
  const { canView, canCreate } = useTenantAccess();
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [teamFilter, setTeamFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [deadlines, setDeadlines] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadRelations = async () => {
      const results = await Promise.allSettled([
        apiFetch<WorkListResponse<WorkProject>>("/tenant/projects?limit=100"),
        apiFetch<WorkListResponse<WorkTask>>("/tenant/projects/tasks?limit=100"),
        canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] as TeamMember[] }),
      ] as const);
      if (!active) return;
      const nextProjects = results[0].status === "fulfilled" ? results[0].value.items || [] : [];
      setProjects(nextProjects);
      setTasks(results[1].status === "fulfilled" ? results[1].value.items || [] : []);
      setMembers(results[2].status === "fulfilled" ? results[2].value.items || [] : []);
      const milestoneLists = await Promise.all(nextProjects.map(async (project) => {
        try {
          const data = await apiFetch<WorkListResponse<WorkMilestone>>(`/tenant/projects/${project.id}/milestones`);
          return (data.items || []).map((milestone) => ({ ...milestone, project_id: project.id }));
        } catch {
          return [];
        }
      }));
      if (active) setMilestones(milestoneLists.flat());
    };
    void loadRelations();
    return () => {
      active = false;
    };
  }, [canView]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const range = view === "week"
        ? { start: startOfWeek(cursor), end: addLocalDays(startOfWeek(cursor), 7) }
        : monthRange(cursor);
      const now = new Date();
      const params: Record<string, string | number> = {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        limit: 300,
      };
      if (teamFilter !== "all") params.assigned_to_user_id = teamFilter;
      const results = await Promise.allSettled([
        calendarApi.listCalendarEvents(params),
        calendarApi.getCalendarDeadlines({
          start: startOfLocalDay(now).toISOString(),
          end: addLocalDays(startOfLocalDay(now), 45).toISOString(),
          limit: 100,
        }),
      ] as const);
      if (!active) return;
      setEvents(results[0].status === "fulfilled" ? results[0].value.items || [] : []);
      setDeadlines(results[1].status === "fulfilled" ? results[1].value.items || [] : []);
      if (results.some((result) => result.status === "rejected")) {
        setError("Il calendario non è completamente disponibile in questo momento.");
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [cursor, teamFilter, view]);

  const projectIdForEvent = (event: CalendarEvent) => {
    if (event.source_entity_type === "project") return event.source_entity_id || undefined;
    if (event.source_entity_type === "task") return tasks.find((task) => task.id === event.source_entity_id)?.project_id;
    if (event.source_entity_type === "milestone") return milestones.find((milestone) => milestone.id === event.source_entity_id)?.project_id;
    return undefined;
  };

  const visibleEvents = useMemo(() => projectFilter === "all"
    ? events
    : events.filter((event) => projectIdForEvent(event) === projectFilter), [events, milestones, projectFilter, tasks]);
  const visibleDeadlines = useMemo(() => deadlines
    .filter((event) => projectFilter === "all" || projectIdForEvent(event) === projectFilter)
    .filter((event) => teamFilter === "all" || event.assigned_to_user_id === teamFilter)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 8), [deadlines, milestones, projectFilter, tasks, teamFilter]);

  const relatedLabel = (event: CalendarEvent) => {
    const project = projects.find((item) => item.id === projectIdForEvent(event));
    return project?.name || getMetadataText(event.metadata, "project_name", "company_name", "client_name");
  };

  const assignee = (event: CalendarEvent) => {
    const member = members.find((item) => item.user_id === event.assigned_to_user_id || item.id === event.assigned_to_user_id);
    return member ? { name: member.display_name, email: member.email } : undefined;
  };

  const groupedDeadlines = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    const now = new Date();
    visibleDeadlines.forEach((event) => {
      const key = deadlineGroup(event, now);
      groups.set(key, [...(groups.get(key) || []), event]);
    });
    return Array.from(groups.entries());
  }, [visibleDeadlines]);

  const moveCursor = (direction: -1 | 1) => {
    const next = new Date(cursor);
    if (view === "week") next.setDate(next.getDate() + direction * 7);
    else next.setMonth(next.getMonth() + direction);
    setCursor(next);
  };

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <WorkPageHeader
        title="Calendario"
        description="Riunioni, attività e consegne organizzate in una sola agenda."
        ctaLabel="Nuovo evento"
        ctaHref="/calendar/events/new"
        canCreate={canCreate("calendar")}
      />

      {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setCursor(new Date())} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Oggi</button>
            <button type="button" onClick={() => moveCursor(-1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Periodo precedente"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => moveCursor(1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Periodo successivo"><ChevronRight className="h-4 w-4" /></button>
            <p className="ml-1 min-w-[190px] text-base font-semibold capitalize text-slate-900">{dateRangeLabel(view, cursor)}</p>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 sm:w-44"><SelectValue placeholder="Team" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tutto il team</SelectItem>{members.filter((member) => member.user_id).map((member) => <SelectItem key={member.id} value={String(member.user_id)}>{member.display_name || member.email}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 sm:w-48"><SelectValue placeholder="Progetti" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tutti i progetti</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="inline-flex h-11 rounded-xl border border-slate-200 bg-white p-1">
              <button type="button" onClick={() => setView("week")} className={view === "week" ? "rounded-lg bg-indigo-50 px-4 text-sm font-semibold text-indigo-600" : "rounded-lg px-4 text-sm text-slate-600"}>Settimana</button>
              <button type="button" onClick={() => setView("month")} className={view === "month" ? "rounded-lg bg-indigo-50 px-4 text-sm font-semibold text-indigo-600" : "rounded-lg px-4 text-sm text-slate-600"}>Mese</button>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {loading ? (
              <div className="flex min-h-[620px] items-center justify-center text-sm text-slate-500">Caricamento calendario…</div>
            ) : view === "week" ? (
              <CalendarWeekGrid weekStart={startOfWeek(cursor)} events={visibleEvents} relatedLabel={relatedLabel} assignee={assignee} />
            ) : (
              <CalendarMonthGrid month={cursor} events={visibleEvents} />
            )}
          </div>

          <aside className="space-y-4 border-t border-slate-200 bg-slate-50/35 p-4 xl:border-l xl:border-t-0">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-900">Prossime scadenze</h2>
              {groupedDeadlines.length ? (
                <div className="mt-4 space-y-5">
                  {groupedDeadlines.map(([group, items]) => (
                    <div key={group}>
                      <p className="mb-2 text-xs font-semibold text-indigo-600">{group}</p>
                      <div className="space-y-2 border-l border-slate-200 pl-3">
                        {items.map((event) => {
                          const tone = calendarTone(event);
                          const owner = assignee(event);
                          return (
                            <Link key={event.id} href={`/calendar/events/${event.id}`} className="relative flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2.5 hover:bg-slate-50">
                              <span className={cn("absolute -left-[17px] h-2 w-2 rounded-full ring-4 ring-white", calendarToneClasses[tone].dot)} />
                              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", calendarToneClasses[tone].surface)}>
                                {calendarTypeLabel(event) === "Attività" ? <UsersRound className="h-4 w-4" /> : calendarTypeLabel(event) === "Milestone" ? <Flag className="h-4 w-4" /> : <CheckSquare2 className="h-4 w-4" />}
                              </span>
                              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-900">{event.title}</p><p className="truncate text-[11px] text-slate-500">{relatedLabel(event) || calendarTypeLabel(event)}</p></div>
                              {owner ? <WorkAvatar name={owner.name} email={owner.email} size="sm" /> : null}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="mt-4"><WorkEmptyState>Nessuna scadenza imminente.</WorkEmptyState></div>}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Tipi di evento</h2>
              <div className="mt-3 grid gap-3 text-sm text-slate-600">
                {[
                  ["violet", "Riunione", CalendarDays],
                  ["blue", "Attività", UsersRound],
                  ["orange", "Milestone", Flag],
                  ["green", "Consegna", CheckSquare2],
                ].map(([tone, label, Icon]) => (
                  <div key={String(label)} className="flex items-center gap-2">
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", calendarToneClasses[tone as keyof typeof calendarToneClasses].surface)}><Icon className="h-4 w-4" /></span>
                    <span>{String(label)}</span>
                  </div>
                ))}
              </div>
            </section>

            <nav className="flex flex-wrap gap-2 px-1 text-xs">
              <Link href="/calendar/agenda" className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-700"><List className="h-3.5 w-3.5" /> Agenda</Link>
              <Link href="/calendar/week" className="font-medium text-indigo-600 hover:text-indigo-700">Settimana estesa</Link>
              <Link href="/calendar/events" className="font-medium text-indigo-600 hover:text-indigo-700">Eventi</Link>
              <Link href="/calendar/deadlines" className="font-medium text-indigo-600 hover:text-indigo-700">Scadenze</Link>
              <Link href="/calendar/timeline" className="font-medium text-indigo-600 hover:text-indigo-700">Timeline</Link>
              <Link href="/calendar/workload" className="font-medium text-indigo-600 hover:text-indigo-700">Carichi</Link>
              <Link href="/calendar/availability" className="font-medium text-indigo-600 hover:text-indigo-700">Disponibilità</Link>
              <Link href="/calendar/conflicts" className="font-medium text-indigo-600 hover:text-indigo-700">Conflitti</Link>
            </nav>
          </aside>
        </div>
      </section>
    </main>
  );
}
