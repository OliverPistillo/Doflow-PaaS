"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Filter,
  LayoutDashboard,
  List,
  Plus,
  Search,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getDoFlowUser } from "@/lib/jwt";
import { teamApi, type TeamMember } from "@/lib/tenant-team-api";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PRIORITIES,
  TASK_STATUSES,
  dateValue,
  isSameLocalDay,
  taskIsOpen,
  taskIsOverdue,
  type WorkChecklistItem,
  type WorkListResponse,
  type WorkProject,
  type WorkTask,
} from "./work-model";
import { WorkPageHeader } from "./work-ui";
import { BOARD_COLUMNS, TaskBoard, type BoardColumnId } from "./task-board";
import { type ChecklistSummary } from "./task-card";
import { TaskListView } from "./task-list-view";
import { TasksSummaryStrip } from "./tasks-summary-strip";

type ViewMode = "board" | "list";
type TaskForm = {
  project_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: string;
  due_at: string;
};

const emptyForm: TaskForm = {
  project_id: "",
  title: "",
  description: "",
  status: "backlog",
  priority: "medium",
  assignee_id: "",
  due_at: "",
};

function toDateTimeLocal(value?: string | null) {
  const date = dateValue(value);
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function TasksWorkspace() {
  const { canView, canCreate, canUpdate } = useTenantAccess();
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [checklistSummary, setChecklistSummary] = useState<Record<string, ChecklistSummary>>({});
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("board");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState<WorkChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const currentUser = getDoFlowUser();

  const load = async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      apiFetch<WorkListResponse<WorkTask>>("/tenant/projects/tasks?limit=100"),
      apiFetch<WorkListResponse<WorkProject>>("/tenant/projects?limit=100"),
      canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] as TeamMember[] }),
    ] as const);
    const nextTasks = results[0].status === "fulfilled" ? results[0].value.items || [] : [];
    setTasks(nextTasks);
    setProjects(results[1].status === "fulfilled" ? results[1].value.items || [] : []);
    setMembers(results[2].status === "fulfilled" ? results[2].value.items || [] : []);
    if (results.some((result) => result.status === "rejected")) {
      setError("Alcuni dettagli delle attività non sono disponibili in questo momento.");
    }
    setLoading(false);

    const summaries = await Promise.all(nextTasks.map(async (task) => {
      try {
        const data = await apiFetch<WorkListResponse<WorkChecklistItem>>(`/tenant/projects/tasks/${task.id}/checklist`);
        const items = data.items || [];
        return [task.id, { done: items.filter((item) => item.is_done).length, total: items.length }] as const;
      } catch {
        return [task.id, { done: 0, total: 0 }] as const;
      }
    }));
    setChecklistSummary(Object.fromEntries(summaries));
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const needle = search.trim().toLowerCase();
    const haystack = `${task.title} ${task.description || ""} ${task.project_name || ""}`.toLowerCase();
    return (!needle || haystack.includes(needle))
      && (projectFilter === "all" || task.project_id === projectFilter)
      && (statusFilter === "all" || task.status === statusFilter)
      && (priorityFilter === "all" || task.priority === priorityFilter)
      && (assigneeFilter === "all" || task.assignee_id === assigneeFilter);
  }), [assigneeFilter, priorityFilter, projectFilter, search, statusFilter, tasks]);

  const now = new Date();
  const summary = {
    open: tasks.filter(taskIsOpen).length,
    mine: currentUser?.sub ? tasks.filter((task) => task.assignee_id === currentUser.sub && taskIsOpen(task)).length : 0,
    today: tasks.filter((task) => {
      const due = dateValue(task.due_at);
      return taskIsOpen(task) && Boolean(due && isSameLocalDay(due, now));
    }).length,
    overdue: tasks.filter((task) => taskIsOverdue(task, now)).length,
  };

  const openCreate = (status = "backlog") => {
    setSelectedTask(null);
    setForm({ ...emptyForm, project_id: projectFilter === "all" ? "" : projectFilter, status });
    setChecklist([]);
    setDialogOpen(true);
  };

  const openTask = async (task: WorkTask) => {
    setSelectedTask(task);
    setForm({
      project_id: task.project_id,
      title: task.title,
      description: task.description || "",
      status: task.status || "backlog",
      priority: task.priority || "medium",
      assignee_id: task.assignee_id || "",
      due_at: toDateTimeLocal(task.due_at),
    });
    setDialogOpen(true);
    try {
      const data = await apiFetch<WorkListResponse<WorkChecklistItem>>(`/tenant/projects/tasks/${task.id}/checklist`);
      setChecklist(data.items || []);
    } catch {
      setChecklist([]);
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.project_id) return;
    setSaving(true);
    setError(null);
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      assignee_id: form.assignee_id || null,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
    };
    try {
      if (selectedTask) {
        await apiFetch(`/tenant/projects/${selectedTask.project_id}/tasks/${selectedTask.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/tenant/projects/${form.project_id}/tasks`, { method: "POST", body: JSON.stringify(body) });
      }
      setDialogOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Salvataggio attività non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const moveTask = async (task: WorkTask, column: BoardColumnId) => {
    const destination = BOARD_COLUMNS.find((item) => item.id === column);
    if (!destination || destination.statuses.includes(String(task.status || ""))) return;
    try {
      await apiFetch(`/tenant/projects/${task.project_id}/tasks/${task.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: destination.nextStatus }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Spostamento attività non riuscito.");
    }
  };

  const addChecklistItem = async () => {
    if (!selectedTask || !newChecklistItem.trim()) return;
    const data = await apiFetch<WorkListResponse<WorkChecklistItem>>(`/tenant/projects/tasks/${selectedTask.id}/checklist`, {
      method: "POST",
      body: JSON.stringify({ title: newChecklistItem.trim() }),
    });
    setChecklist(data.items || []);
    setNewChecklistItem("");
  };

  const toggleChecklistItem = async (item: WorkChecklistItem) => {
    if (!selectedTask) return;
    const data = await apiFetch<WorkListResponse<WorkChecklistItem>>(`/tenant/projects/tasks/${selectedTask.id}/checklist/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_done: !item.is_done }),
    });
    setChecklist(data.items || []);
  };

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <WorkPageHeader title="Attività" description="Organizza il lavoro quotidiano senza perdere priorità e responsabilità.">
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-xl border-slate-200 bg-white pl-10" placeholder="Cerca..." />
        </div>
        <Button variant="outline" onClick={() => setFiltersOpen((value) => !value)} className="h-11 rounded-xl border-slate-200 bg-white">
          <Filter className="mr-2 h-4 w-4" /> Filtri
        </Button>
        <div className="inline-flex h-11 rounded-xl border border-slate-200 bg-white p-1">
          <button type="button" onClick={() => setView("board")} className={view === "board" ? "inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 text-sm font-semibold text-indigo-600" : "inline-flex items-center gap-2 rounded-lg px-3 text-sm text-slate-600"}>
            <LayoutDashboard className="h-4 w-4" /> Bacheca
          </button>
          <button type="button" onClick={() => setView("list")} className={view === "list" ? "inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 text-sm font-semibold text-indigo-600" : "inline-flex items-center gap-2 rounded-lg px-3 text-sm text-slate-600"}>
            <List className="h-4 w-4" /> Elenco
          </button>
        </div>
        {canCreate("projects") ? <Button onClick={() => openCreate()} className="h-11 rounded-xl bg-indigo-600 px-5 text-white hover:bg-indigo-700"><Plus className="mr-2 h-4 w-4" /> Nuova attività</Button> : null}
      </WorkPageHeader>

      {filtersOpen ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
          <Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger className="h-11 rounded-xl border-slate-200"><SelectValue placeholder="Progetto" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i progetti</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-11 rounded-xl border-slate-200"><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem>{TASK_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}><SelectTrigger className="h-11 rounded-xl border-slate-200"><SelectValue placeholder="Priorità" /></SelectTrigger><SelectContent><SelectItem value="all">Tutte le priorità</SelectItem>{PRIORITIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}><SelectTrigger className="h-11 rounded-xl border-slate-200"><SelectValue placeholder="Responsabile" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i responsabili</SelectItem>{members.filter((member) => member.user_id).map((member) => <SelectItem key={member.id} value={String(member.user_id)}>{member.display_name || member.email}</SelectItem>)}</SelectContent></Select>
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</p> : null}

      <TasksSummaryStrip loading={loading} open={summary.open} mine={summary.mine} today={summary.today} overdue={summary.overdue} />

      {loading ? (
        <div className="flex min-h-80 items-center justify-center text-sm text-slate-500">Caricamento attività…</div>
      ) : view === "board" ? (
        <TaskBoard
          tasks={visibleTasks}
          members={members}
          checklistSummary={checklistSummary}
          canMove={canUpdate("projects")}
          canCreate={canCreate("projects")}
          onOpen={(task) => void openTask(task)}
          onMove={(task, column) => void moveTask(task, column)}
          onAdd={openCreate}
        />
      ) : (
        <TaskListView tasks={visibleTasks} members={members} onOpen={(task) => void openTask(task)} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTask ? "Dettaglio attività" : "Nuova attività"}</DialogTitle>
            <DialogDescription>{selectedTask ? "Aggiorna i dati reali del task o gestisci la checklist." : "Crea un task collegato a un progetto esistente."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2"><Label>Progetto</Label><Select value={form.project_id || "__none__"} onValueChange={(value) => setForm((current) => ({ ...current, project_id: value === "__none__" ? "" : value }))} disabled={Boolean(selectedTask)}><SelectTrigger><SelectValue placeholder="Seleziona progetto" /></SelectTrigger><SelectContent><SelectItem value="__none__">Seleziona progetto</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2 sm:col-span-2"><Label>Titolo</Label><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="grid gap-2 sm:col-span-2"><Label>Descrizione</Label><Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Stato</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TASK_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Priorità</Label><Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Responsabile</Label><Select value={form.assignee_id || "__none__"} onValueChange={(value) => setForm((current) => ({ ...current, assignee_id: value === "__none__" ? "" : value }))}><SelectTrigger><SelectValue placeholder="Non assegnata" /></SelectTrigger><SelectContent><SelectItem value="__none__">Non assegnata</SelectItem>{members.filter((member) => member.user_id).map((member) => <SelectItem key={member.id} value={String(member.user_id)}>{member.display_name || member.email}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Scadenza</Label><Input type="datetime-local" value={form.due_at} onChange={(event) => setForm((current) => ({ ...current, due_at: event.target.value }))} /></div>
          </div>

          {selectedTask ? (
            <div className="border-t border-slate-200 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Checklist</h3>
                <Link href={`/projects/${selectedTask.project_id}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Apri progetto</Link>
              </div>
              <div className="flex gap-2">
                <Input value={newChecklistItem} onChange={(event) => setNewChecklistItem(event.target.value)} placeholder="Nuovo punto checklist" />
                <Button type="button" variant="outline" onClick={() => void addChecklistItem()} disabled={!newChecklistItem.trim() || !canUpdate("projects")}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="mt-3 space-y-2">
                {checklist.map((item) => (
                  <button key={item.id} type="button" onClick={() => canUpdate("projects") && void toggleChecklistItem(item)} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
                    <span className={item.is_done ? "flex h-5 w-5 items-center justify-center rounded border border-emerald-500 bg-emerald-500 text-white" : "flex h-5 w-5 items-center justify-center rounded border border-slate-300"}>{item.is_done ? <Check className="h-3.5 w-3.5" /> : null}</span>
                    <span className={item.is_done ? "text-slate-400 line-through" : "text-slate-700"}>{item.title}</span>
                  </button>
                ))}
                {!checklist.length ? <p className="py-3 text-center text-sm text-slate-500">Nessun punto checklist.</p> : null}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            {(selectedTask ? canUpdate("projects") : canCreate("projects")) ? <Button onClick={() => void save()} disabled={saving || !form.title.trim() || !form.project_id}>{saving ? "Salvataggio…" : "Salva"}</Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
