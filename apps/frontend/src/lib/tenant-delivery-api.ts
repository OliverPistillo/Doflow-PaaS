import { apiFetch } from "@/lib/api";
import type {
  CommercialProject, CommercialProjectPhase, CustomerActivity, ProjectTimeSession,
} from "@/features/commercial/commercial-provider-types";

export type DeliveryRow = Record<string, unknown> & { id: string };
export type DeliveryHistoryRow = DeliveryRow & {
  event_type: string;
  actor_name?: string | null;
  actor_user_id?: string | null;
  reason?: string | null;
  next_state?: Record<string, unknown> | null;
  created_at: string;
};
export type DeliveryWorkspace = {
  project: DeliveryRow;
  members: DeliveryRow[];
  phases: DeliveryRow[];
  tasks: DeliveryRow[];
  qa: DeliveryRow[];
  timers: DeliveryRow[];
  publications: DeliveryRow[];
  correlationId?: string;
  unchanged?: boolean;
};
type DeliveryResult<T = DeliveryRow> = { item: T; correlationId: string; unchanged?: boolean; progress?: number; publication_version?: number };

function key(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}
function mutation<T>(url: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, prefix: string) {
  return apiFetch<T>(url, {
    method,
    headers: { "Idempotency-Key": key(prefix) },
    body: JSON.stringify(body),
  });
}

export const deliveryApi = {
  listProjects(signal?: AbortSignal) {
    return apiFetch<{ items: DeliveryRow[] }>("/tenant/delivery/projects", { signal });
  },
  workspace(projectId: string, signal?: AbortSignal) {
    return apiFetch<DeliveryWorkspace>(
      `/tenant/delivery/projects/${encodeURIComponent(projectId)}`,
      { signal },
    );
  },
  createProject(body: Record<string, unknown>) { return mutation<DeliveryWorkspace>("/tenant/delivery/projects", "POST", body, "project-create"); },
  updateProject(projectId: string, body: Record<string, unknown>) { return mutation<DeliveryWorkspace>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}`, "PATCH", body, "project-update"); },
  transitionProject(projectId: string, body: Record<string, unknown>) { return mutation<DeliveryWorkspace>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/status`, "PATCH", body, "project-status"); },
  archiveProject(projectId: string, version: number, reason: string) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}`, "DELETE", { version, reason }, "project-archive"); },
  restoreProject(projectId: string, version: number, reason: string) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/restore`, "POST", { version, reason }, "project-restore"); },
  upsertMember(projectId: string, body: Record<string, unknown>) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/members`, "POST", body, "project-member"); },
  updateMember(projectId: string, memberId: string, body: Record<string, unknown>) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`, "PATCH", body, "project-member-update"); },
  removeMember(projectId: string, memberId: string, version: number, reason: string) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`, "DELETE", { version, reason }, "project-member-remove"); },
  createPhase(projectId: string, body: Record<string, unknown>) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/phases`, "POST", body, "phase-create"); },
  updatePhase(projectId: string, phaseId: string, body: Record<string, unknown>) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/phases/${encodeURIComponent(phaseId)}`, "PATCH", body, "phase-update"); },
  deletePhase(projectId: string, phaseId: string, version: number, reason: string) { return mutation<{ ok: true }>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/phases/${encodeURIComponent(phaseId)}`, "DELETE", { version, reason }, "phase-delete"); },
  reorderPhases(projectId: string, version: number, phaseIds: string[]) { return mutation<DeliveryWorkspace>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/phases/reorder`, "PATCH", { version, phase_ids: phaseIds }, "phase-reorder"); },
  transitionTask(projectId: string, taskId: string, body: Record<string, unknown>) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/status`, "PATCH", body, "task-status"); },
  createTask(projectId: string, body: Record<string, unknown>) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/tasks`, "POST", body, "task-create"); },
  updateTask(projectId: string, taskId: string, body: Record<string, unknown>) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, "PATCH", body, "task-update"); },
  reorderTasks(projectId: string, body: Record<string, unknown>) { return mutation<DeliveryWorkspace>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/tasks/reorder`, "PATCH", body, "task-reorder"); },
  archiveTask(projectId: string, taskId: string, version: number, reason: string) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, "DELETE", { version, reason }, "task-archive"); },
  generateTaskRecurrence(projectId: string, taskId: string, version: number) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/recurrence`, "POST", { version }, "task-recurrence"); },
  startTimer(projectId: string, taskId?: string) { return mutation<DeliveryResult<ProjectTimeSession>>("/tenant/delivery/timers/start", "POST", { project_id: projectId, ...(taskId ? { task_id: taskId } : {}) }, "timer-start"); },
  stopTimer(sessionId: string, version: number, description?: string) { return mutation<DeliveryResult<ProjectTimeSession>>(`/tenant/delivery/timers/${encodeURIComponent(sessionId)}/stop`, "POST", { version, stop_key: `stop:${sessionId}:${crypto.randomUUID()}`, description }, "timer-stop"); },
  correctTimer(sessionId: string, body: Record<string, unknown>) { return mutation<DeliveryResult<ProjectTimeSession>>(`/tenant/delivery/timers/${encodeURIComponent(sessionId)}`, "PATCH", body, "timer-correct"); },
  archiveTimer(sessionId: string, version: number, reason: string) { return mutation<DeliveryResult<ProjectTimeSession>>(`/tenant/delivery/timers/${encodeURIComponent(sessionId)}`, "DELETE", { version, reason }, "timer-archive"); },
  updateQa(projectId: string, itemId: string, version: number, completed: boolean, comment?: string) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/qa/items/${encodeURIComponent(itemId)}`, "PATCH", { version, completed, comment }, "qa-item"); },
  submitQa(projectId: string, projectVersion: number, taskId: string) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/qa/submit`, "POST", { version: projectVersion, task_id: taskId }, "qa-submit"); },
  requestChanges(projectId: string, projectVersion: number, taskId: string, note: string) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/qa/changes`, "POST", { version: projectVersion, task_id: taskId, note }, "qa-changes"); },
  approveQa(projectId: string, projectVersion: number, taskId: string, note: string, overrideReason?: string) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/qa/approve`, "POST", { version: projectVersion, task_id: taskId, note, override_reason: overrideReason }, "qa-approve"); },
  publish(projectId: string, version: number, notes?: string) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/publish`, "POST", { version, notes }, "project-publish"); },
  deliver(projectId: string, version: number, notes?: string) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/deliver`, "POST", { version, notes }, "project-deliver"); },
  linkActivity(projectId: string, activityId: string, version: number, phaseId?: string) { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/activities/${encodeURIComponent(activityId)}/link`, "POST", { version, phase_id: phaseId }, "activity-link"); },
  unlinkActivity(projectId: string, activityId: string, version: number, reason = "Scollegamento attività") { return mutation<DeliveryResult>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/activities/${encodeURIComponent(activityId)}/unlink`, "POST", { version, reason }, "activity-unlink"); },
  history(projectId: string) { return apiFetch<{ items: DeliveryHistoryRow[] }>(`/tenant/delivery/projects/${encodeURIComponent(projectId)}/history?limit=200`); },
};

const text = (value: unknown) => typeof value === "string" ? value : value == null ? "" : String(value);
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const date = (value: unknown) => value ? new Date(String(value)).toISOString() : undefined;

export function mapDeliveryPhase(row: DeliveryRow): CommercialProjectPhase {
  const rawStatus = text(row.status);
  return {
    id: row.id, version: number(row.version, 1), name: text(row.title), description: text(row.description) || undefined,
    status: rawStatus === "completed" ? "completed" : rawStatus === "in_progress" || rawStatus === "blocked" ? "in_progress" : "not_started",
    order: number(row.sort_order), startDate: text(row.planned_start_at || row.start_date) || undefined,
    dueDate: text(row.planned_due_at || row.due_date) || undefined, completedAt: date(row.actual_end_at || row.completed_at),
    activityIds: Array.isArray(row.task_ids) ? row.task_ids.map(String) : [], createdAt: date(row.created_at) || new Date(0).toISOString(),
    updatedAt: date(row.updated_at) || date(row.created_at) || new Date(0).toISOString(), estimatedMinutes: number(row.estimated_minutes),
    weight: number(row.weight, 1),
  };
}

export function mapDeliveryTask(row: DeliveryRow): CustomerActivity {
  const status = text(row.status);
  const priority = text(row.priority);
  const work = text(row.work_status);
  const recurrenceRule = row.recurrence_rule && typeof row.recurrence_rule === "object" ? row.recurrence_rule as Record<string, unknown> : undefined;
  const recurrenceFrequency = text(recurrenceRule?.frequency);
  return {
    id: row.id, version: number(row.version, 1), title: text(row.title), description: text(row.description), type: "Attività",
    status: status === "done" ? "Completata" : status === "in_progress" || status === "internal_review" || status === "client_review" ? "In corso" : status === "blocked" ? "Bloccata" : "Da fare",
    priority: priority === "urgent" ? "Urgente" : priority === "high" ? "Alta" : priority === "low" ? "Bassa" : "Media",
    assigneeId: text(row.assignee_id), collaboratorIds: Array.isArray(row.collaborator_ids) ? row.collaborator_ids.map(String) : [],
    projectId: text(row.project_id), phaseId: text(row.milestone_id) || undefined, dueAt: text(row.due_at),
    dueDate: text(row.due_at).slice(0, 10), originalDueAt: text(row.original_due_at || row.due_at), dueDateHistory: Array.isArray(row.due_date_history) ? row.due_date_history.map((entry) => ({ previousDueAt: text((entry as DeliveryRow).previous_due_at), nextDueAt: text((entry as DeliveryRow).new_due_at), changedAt: text((entry as DeliveryRow).changed_at), changedBy: text((entry as DeliveryRow).changed_by), reason: text((entry as DeliveryRow).reason) })) : [], recurrence: recurrenceFrequency === "weekly" ? "Settimanale" : recurrenceFrequency === "monthly" && number(recurrenceRule?.interval, 1) === 3 ? "Trimestrale" : recurrenceFrequency === "monthly" ? "Mensile" : recurrenceFrequency === "annual" ? "Annuale" : "Nessuna",
    dependencyIds: Array.isArray(row.dependency_ids) ? row.dependency_ids.map(String) : [], blockedReason: text(row.blocked_reason) || undefined, kanbanOrder: number(row.kanban_order),
    createdAt: date(row.created_at) || new Date(0).toISOString(), createdBy: "Sistema", updatedAt: date(row.updated_at) || date(row.created_at) || new Date(0).toISOString(),
    completedAt: date(row.completed_at), origin: "manuale", attachments: [], estimatedMinutes: number(row.estimated_minutes), visibility: "internal", checklist: Array.isArray(row.checklist) ? row.checklist.map((item) => ({ id: text((item as DeliveryRow).id), label: text((item as DeliveryRow).title), completedAt: date((item as DeliveryRow).completed_at), completedBy: text((item as DeliveryRow).completed_by) || undefined })) : [],
    workStatus: work === "submitted" ? "In attesa di approvazione" : work === "approved" ? "Approvato internamente" : work === "changes_requested" ? "Modifiche richieste" : status === "done" ? "Completato dal collaboratore" : "In lavorazione",
    workVersion: number(row.work_version, 1), submittedAt: date(row.submitted_at), submittedBy: text(row.submitted_by) || undefined,
    approval: row.approved_at ? { version: number(row.work_version, 1), approvedAt: date(row.approved_at)!, approvedBy: text(row.approved_by), note: text(row.approval_note), checklist: [] } : undefined,
    changesRequestedAt: date(row.changes_requested_at), changesRequestedBy: text(row.changes_requested_by) || undefined,
    changesRequestNote: text(row.changes_request_note) || undefined,
  };
}

export function mapDeliveryTimer(row: DeliveryRow): ProjectTimeSession {
  const endedAt = date(row.ended_at);
  return {
    id: row.id,
    version: number(row.version, 1),
    projectId: text(row.project_id),
    activityId: text(row.task_id) || undefined,
    userId: text(row.user_id),
    startedAt: date(row.started_at) || new Date(0).toISOString(),
    endedAt,
    durationMinutes: endedAt
      ? Math.ceil(number(row.duration_seconds) / 60)
      : undefined,
    status: endedAt ? "completed" : "active",
    description: text(row.description) || undefined,
    manual: false,
    correctedAt: date(row.corrected_at),
    archivedAt: date(row.deleted_at),
  };
}

export function mapDeliveryProject(workspace: DeliveryWorkspace): CommercialProject {
  const row = workspace.project;
  const members = workspace.members;
  const createdAt = date(row.created_at) || new Date(0).toISOString();
  return {
    id: row.id, version: number(row.version, 1), clientId: text(row.company_id), sourceLeadId: text(row.lead_id || row.opportunity_id) || undefined,
    orderId: text(row.order_id) || undefined, name: text(row.name), service: text(row.type), type: (text(row.type) || "other") as CommercialProject["type"],
    status: (text(row.status) || "not_started") as CommercialProject["status"], priority: (text(row.priority) || "medium") as CommercialProject["priority"],
    ownerId: text(row.project_manager_id), memberIds: members.map((member) => text(member.user_id)),
    supervisorIds: members.filter((member) => text(member.role) === "supervisor").map((member) => text(member.user_id)),
    description: text(row.description), startDate: text(row.start_date) || undefined, dueDate: text(row.due_date) || undefined,
    agreedValue: 0, activityIds: workspace.tasks.map((task) => task.id), phases: workspace.phases.map(mapDeliveryPhase),
    qaChecklist: workspace.qa.map((item) => ({ id: item.id, label: text(item.label), required: item.required !== false, completedAt: date(item.completed_at), completedBy: text(item.completed_by) || undefined })),
    clientUpdatePublishedAt: date(row.published_at), clientUpdatePublishedBy: text(row.published_by) || undefined,
    clientUpdateVersion: workspace.publications.length ? number(workspace.publications[0].publication_version, 1) : undefined,
    createdAt, createdBy: text(row.created_by) || "Sistema", updatedAt: date(row.updated_at) || createdAt,
    completedAt: date(row.closed_at), deliveredAt: date(row.delivered_at), deliveredBy: text(row.delivered_by) || undefined,
    progress: number(row.progress), archivedAt: date(row.deleted_at),
  };
}
