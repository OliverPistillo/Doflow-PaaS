export type WorkProject = {
  id: string;
  name: string;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  priority?: string | null;
  progress?: number | string | null;
  current_phase?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  project_manager_id?: string | null;
  project_manager_email?: string | null;
  start_date?: string | null;
  due_date?: string | null;
};

export type WorkTask = {
  id: string;
  project_id: string;
  project_name?: string | null;
  milestone_id?: string | null;
  milestone_title?: string | null;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  assignee_id?: string | null;
  assignee_email?: string | null;
  due_at?: string | null;
  estimated_minutes?: number | null;
  actual_minutes?: number | null;
  completed_at?: string | null;
};

export type WorkMilestone = {
  id: string;
  project_id?: string;
  project_name?: string;
  title: string;
  status?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
};

export type WorkChecklistItem = {
  id: string;
  task_id: string;
  title: string;
  is_done?: boolean | null;
};

export type WorkListResponse<T> = {
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
};

export const PROJECT_STATUSES = [
  ["to_start", "Da avviare"],
  ["kickoff", "Kick-off"],
  ["materials_collection", "Raccolta materiali"],
  ["strategy", "Strategia"],
  ["ux_ui", "UX/UI"],
  ["copy_content", "Copy/contenuti"],
  ["development", "Sviluppo"],
  ["internal_review", "Revisione interna"],
  ["client_review", "Revisione cliente"],
  ["corrections", "Correzioni"],
  ["seo_performance", "SEO/Performance"],
  ["qa", "QA"],
  ["publishing", "Pubblicazione"],
  ["training", "Formazione"],
  ["delivered", "Consegnato"],
  ["maintenance", "Manutenzione"],
  ["closed", "Chiuso"],
  ["blocked", "Bloccato"],
] as const;

export const TASK_STATUSES = [
  ["backlog", "Backlog"],
  ["ready", "Da fare"],
  ["in_progress", "In corso"],
  ["internal_review", "Revisione interna"],
  ["client_review", "Revisione cliente"],
  ["blocked", "Bloccata"],
  ["done", "Completata"],
] as const;

export const PRIORITIES = [
  ["low", "Bassa"],
  ["medium", "Media"],
  ["high", "Alta"],
  ["urgent", "Urgente"],
] as const;

export function optionLabel(options: ReadonlyArray<readonly [string, string]>, value?: string | null) {
  return options.find(([key]) => key === value)?.[1] || String(value || "").replace(/_/g, " ") || "—";
}

export function dateValue(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addLocalDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date: Date) {
  const start = startOfLocalDay(date);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  return start;
}

export function endOfWeek(date: Date) {
  const end = addLocalDays(startOfWeek(date), 7);
  end.setMilliseconds(-1);
  return end;
}

export function formatShortDate(value?: string | Date | null) {
  const date = value instanceof Date ? value : dateValue(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(date);
}

export function formatTime(value?: string | Date | null) {
  const date = value instanceof Date ? value : dateValue(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function projectIsActive(project: WorkProject) {
  return !["delivered", "closed"].includes(String(project.status || ""));
}

export function projectIsAtRisk(project: WorkProject, now = new Date()) {
  const due = dateValue(project.due_date);
  return project.status === "blocked"
    || ["high", "urgent"].includes(String(project.priority || ""))
    || Boolean(due && due < startOfLocalDay(now) && projectIsActive(project));
}

export function taskIsOpen(task: WorkTask) {
  return task.status !== "done";
}

export function taskIsOverdue(task: WorkTask, now = new Date()) {
  const due = dateValue(task.due_at);
  return taskIsOpen(task) && Boolean(due && due < startOfLocalDay(now));
}

export function getMetadataText(metadata: unknown, ...keys: string[]) {
  if (!metadata || typeof metadata !== "object") return undefined;
  const record = metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}
