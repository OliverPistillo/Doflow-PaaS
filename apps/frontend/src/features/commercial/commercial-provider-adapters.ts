import {
  normalizePipelineStage,
  pipelineStages,
} from "@/features/commercial/pipeline-stages";
import type { CommercialContract } from "@/features/commercial/commercial-commerce";
import type { CommercialComment } from "@/features/commercial/commercial-collaboration";
import type { CommercialAutomationRule } from "@/features/commercial/commercial-automations";
import type { CommercialLead, PipelineStage } from "@/features/commercial/types";
import {
  type CommercialCustomer,
  type CustomerActivity,
  type CommercialProject,
  type CommercialProjectPhase,
} from "@/features/commercial/commercial-provider-types";
import { apiFetch } from "@/lib/api";
import {
  commercialApi,
  type CommercialOpportunity,
} from "@/lib/tenant-commercial-api";

export const initialOrder = () =>
  Object.fromEntries(
    pipelineStages.map((stage) => [stage.id, [] as string[]]),
  ) as unknown as Record<PipelineStage, string[]>;

export type LegacyCustomerActivity = Partial<CustomerActivity> & {
  id?: string;
  activityId?: string;
  title: string;
  dueAt?: string;
};

export function getCanonicalActivityId(activity: LegacyCustomerActivity) {
  return activity.id || activity.activityId || "";
}

export function getCanonicalCustomerActivities(
  customer?: CommercialCustomer | null,
): CustomerActivity[] {
  const records = [
    ...(customer?.activities ?? []),
    ...(customer?.onboardingActivity ? [customer.onboardingActivity] : []),
  ] as LegacyCustomerActivity[];
  const seen = new Set<string>();
  return records.flatMap((activity) => {
    const id = getCanonicalActivityId(activity);
    if (!id || seen.has(id) || activity.archivedAt) return [];
    seen.add(id);
    return [{ ...activity, id } as CustomerActivity];
  });
}

export function resolveCanonicalCustomerActivityId(
  customer: CommercialCustomer | null | undefined,
  referenceId: string,
) {
  return (
    getCanonicalCustomerActivities(customer).find(
      (activity) =>
        activity.id === referenceId ||
        (activity as LegacyCustomerActivity).activityId === referenceId,
    )?.id ?? referenceId
  );
}

export function synchronizeProjectPhases(
  project: CommercialProject,
  customer: CommercialCustomer | null | undefined,
  now: string,
) {
  const activities = getCanonicalCustomerActivities(customer);
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  const changes: Array<{
    phase: CommercialProjectPhase;
    previousStatus: CommercialProjectPhase["status"];
  }> = [];
  const phases = project.phases.map((phase) => {
    const activityIds = Array.from(
      new Set(
        phase.activityIds.map((id) =>
          resolveCanonicalCustomerActivityId(customer, id),
        ),
      ),
    );
    const linked = activityIds.flatMap((id) => {
      const activity = byId.get(id);
      return activity && activity.status !== "Annullata" && !activity.archivedAt
        ? [activity]
        : [];
    });
    const status: CommercialProjectPhase["status"] =
      linked.length === 0
        ? "not_started"
        : linked.every((activity) => activity.status === "Completata")
          ? "completed"
          : "in_progress";
    const completedAt =
      status === "completed" ? (phase.completedAt ?? now) : undefined;
    const changed =
      phase.status !== status ||
      phase.completedAt !== completedAt ||
      phase.activityIds.length !== activityIds.length ||
      phase.activityIds.some((id, index) => id !== activityIds[index]);
    if (!changed) return phase;
    changes.push({
      phase: { ...phase, activityIds, status, completedAt, updatedAt: now },
      previousStatus: phase.status,
    });
    return changes[changes.length - 1].phase;
  });
  return { phases, changes };
}

export function normalizeActivity(
  activity:
    | LegacyCustomerActivity
    | {
        id?: string;
        activityId?: string;
        title: string;
        dueAt?: string;
        assigneeId?: string;
        priority?: string;
      },
  fallback: { assigneeId: string; createdAt: string },
  onboarding = false,
): CustomerActivity {
  const dueAt = activity.dueAt ?? "";
  const input = activity as Partial<CustomerActivity>;
  return {
    id: getCanonicalActivityId(activity as LegacyCustomerActivity),
    version: input.version,
    activityId: (activity as LegacyCustomerActivity).activityId,
    title: activity.title,
    description:
      input.description ??
      (onboarding
        ? "Avviare la raccolta delle informazioni, dei materiali e degli accessi necessari."
        : ""),
    type: onboarding ? "Onboarding" : (input.type ?? "Attività"),
    status: input.status ?? "Da fare",
    priority: onboarding ? "Alta" : (input.priority ?? "Media"),
    assigneeId: activity.assigneeId ?? fallback.assigneeId,
    collaboratorIds: input.collaboratorIds ?? [],
    leadId: input.leadId,
    projectId: input.projectId,
    phaseId: input.phaseId,
    startAt: input.startAt,
    dueAt,
    dueDate: input.dueDate ?? dueAt.slice(0, 10),
    originalDueAt: input.originalDueAt ?? dueAt,
    dueDateHistory: input.dueDateHistory ?? [],
    dueTime: input.dueTime,
    recurrence: input.recurrence ?? "Nessuna",
    recurrenceOriginId: input.recurrenceOriginId,
    nextRecurrenceId: input.nextRecurrenceId,
    dependencyIds: input.dependencyIds ?? [],
    blockedReason: input.blockedReason,
    notes: input.notes,
    technicalCategory: input.technicalCategory,
    createdAt: input.createdAt ?? fallback.createdAt,
    createdBy: input.createdBy ?? "Sistema",
    updatedAt: input.updatedAt ?? fallback.createdAt,
    completedAt: input.completedAt,
    archivedAt: input.archivedAt,
    origin: input.origin ?? (onboarding ? "conversione cliente" : "manuale"),
    attachments: input.attachments ?? [],
    estimatedMinutes: input.estimatedMinutes,
    weight: input.weight,
    visibility: input.visibility ?? "internal",
    clientVisibleAt: input.clientVisibleAt,
    checklist: input.checklist ?? [],
    kanbanOrder:
      input.kanbanOrder ??
      (Date.parse(input.createdAt ?? fallback.createdAt) || 0),
    workStatus: input.workStatus,
    workVersion: input.workVersion,
    submittedAt: input.submittedAt,
    submittedBy: input.submittedBy,
    approval: input.approval,
    changesRequestedAt: input.changesRequestedAt,
    changesRequestedBy: input.changesRequestedBy,
    changesRequestNote: input.changesRequestNote,
    publishedAt: input.publishedAt,
    publishedBy: input.publishedBy,
  };
}

export const workflowControlledActivityKeys = [
  "workStatus",
  "workVersion",
  "submittedAt",
  "submittedBy",
  "approval",
  "changesRequestedAt",
  "changesRequestedBy",
  "changesRequestNote",
  "publishedAt",
  "publishedBy",
  "clientVisibleAt",
] as const satisfies readonly (keyof CustomerActivity)[];

export function getWorkflowSafeActivityUpdates(
  activity: CustomerActivity,
  updates: Partial<CustomerActivity>,
) {
  const safeUpdates = { ...updates };
  workflowControlledActivityKeys.forEach((key) => delete safeUpdates[key]);
  if (
    !safeUpdates.status ||
    safeUpdates.status === activity.status ||
    !activity.projectId
  )
    return safeUpdates;
  return {
    ...safeUpdates,
    workStatus:
      safeUpdates.status === "Completata"
        ? ("Completato dal collaboratore" as const)
        : activity.workStatus === "Modifiche richieste"
          ? activity.workStatus
          : ("In lavorazione" as const),
    submittedAt: undefined,
    submittedBy: undefined,
    approval: undefined,
    publishedAt: undefined,
    publishedBy: undefined,
    clientVisibleAt: undefined,
  };
}

export function nextRecurrenceDate(
  value: string,
  recurrence: CustomerActivity["recurrence"],
) {
  if (!value || recurrence === "Nessuna") return "";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return "";
  if (recurrence === "Settimanale") date.setDate(date.getDate() + 7);
  else if (recurrence === "Mensile") date.setMonth(date.getMonth() + 1);
  else if (recurrence === "Trimestrale") date.setMonth(date.getMonth() + 3);
  else date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}

export function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter(
    (item) => !seen.has(item.id) && Boolean(seen.add(item.id)),
  );
}
export function hasMeaningfulChanges<T extends object>(
  record: T,
  updates: Partial<T>,
) {
  return Object.entries(updates).some(
    ([key, value]) =>
      JSON.stringify(record[key as keyof T]) !== JSON.stringify(value),
  );
}
export type ServerList<T> = { items: T[]; total?: number };
export type ServerActivity = Record<string, unknown> & { id: string };
export type ServerProject = Record<string, unknown> & { id: string };

export function projectApiBody(project: Partial<CommercialProject> & { id?: string }) {
  return {
    ...(project.id ? { id: project.id } : {}),
    ...(project.clientId ? { company_id: project.clientId } : {}),
    ...(project.name !== undefined ? { name: project.name } : {}),
    ...(project.description !== undefined
      ? { description: project.description }
      : {}),
    ...(project.type !== undefined ? { type: project.type } : {}),
    ...(project.status !== undefined ? { status: project.status } : {}),
    ...(project.priority !== undefined ? { priority: project.priority } : {}),
    ...(project.ownerId ? { project_manager_id: project.ownerId } : {}),
    ...(project.startDate !== undefined
      ? { start_date: project.startDate || null }
      : {}),
    ...(project.dueDate !== undefined
      ? { due_date: project.dueDate || null }
      : {}),
    ...(project.deliveredAt !== undefined
      ? { delivered_at: project.deliveredAt || null }
      : {}),
  };
}

export function taskApiBody(
  activity: Partial<CustomerActivity> & { id?: string },
  companyId?: string,
) {
  const statusMap: Partial<Record<CustomerActivity["status"], string>> = {
    "Da fare": "todo",
    "In corso": "in_progress",
    "In attesa cliente": "blocked",
    Bloccata: "blocked",
    Completata: "done",
    Annullata: "cancelled",
  };
  const priorityMap: Partial<Record<CustomerActivity["priority"], string>> = {
    Bassa: "low",
    Media: "medium",
    Alta: "high",
    Urgente: "urgent",
  };
  return {
    ...(activity.id ? { id: activity.id } : {}),
    ...(activity.projectId ? { project_id: activity.projectId } : {}),
    ...(activity.phaseId ? { milestone_id: activity.phaseId } : {}),
    ...(companyId ? { company_id: companyId } : {}),
    ...(activity.title !== undefined ? { title: activity.title } : {}),
    ...(activity.description !== undefined
      ? { description: activity.description }
      : {}),
    ...(activity.status
      ? { status: statusMap[activity.status] || "todo" }
      : {}),
    ...(activity.priority
      ? { priority: priorityMap[activity.priority] || "medium" }
      : {}),
    ...(activity.assigneeId !== undefined
      ? { assignee_id: activity.assigneeId || null }
      : {}),
    ...(activity.dueAt !== undefined ? { due_at: activity.dueAt || null } : {}),
    ...(activity.estimatedMinutes !== undefined
      ? { estimated_minutes: activity.estimatedMinutes || null }
      : {}),
    ...(activity.blockedReason !== undefined
      ? { blocked_reason: activity.blockedReason || null }
      : {}),
    ...(activity.completedAt !== undefined
      ? { completed_at: activity.completedAt || null }
      : {}),
  };
}

export function createActivityOnServer(
  customer: CommercialCustomer,
  activity: CustomerActivity,
) {
  if (activity.projectId) {
    return apiFetch(`/tenant/projects/${activity.projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(taskApiBody(activity, customer.id)),
    });
  }
  return commercialApi.createActivity({
    company_id: customer.id,
    opportunity_id: activity.leadId || customer.sourceLeadId,
    type:
      activity.type === "Chiamata"
        ? "call"
        : activity.type === "Riunione"
          ? "meeting"
          : activity.type === "Email"
            ? "email"
            : "task",
    title: activity.title,
    description: activity.description,
    due_at: activity.dueAt,
    completed_at: activity.completedAt || null,
    assigned_to: activity.assigneeId || null,
    status:
      activity.status === "Completata"
        ? "completed"
        : activity.status === "In corso"
          ? "in_progress"
          : activity.status === "In attesa cliente" || activity.status === "Bloccata"
            ? "waiting_client"
            : activity.status === "Annullata"
              ? "cancelled"
              : "todo",
    priority:
      activity.priority === "Urgente"
        ? "urgent"
        : activity.priority === "Alta"
          ? "high"
          : activity.priority === "Bassa"
            ? "low"
            : "medium",
    kanban_order: activity.kanbanOrder || 0,
  });
}

export function updateActivityOnServer(
  customer: CommercialCustomer,
  activity: CustomerActivity,
  updates: Partial<CustomerActivity>,
) {
  if (activity.projectId) {
    return apiFetch(
      `/tenant/projects/${activity.projectId}/tasks/${activity.id}`,
      {
        method: "PATCH",
        body: JSON.stringify(taskApiBody(updates, customer.id)),
      },
    );
  }
  return commercialApi.updateActivity(activity.id, {
    version: activity.version,
    ...(updates.title !== undefined ? { title: updates.title } : {}),
    ...(updates.description !== undefined
      ? { description: updates.description }
      : {}),
    ...(updates.dueAt !== undefined ? { due_at: updates.dueAt || null } : {}),
    ...(updates.completedAt !== undefined || updates.status !== undefined
      ? {
          completed_at:
            updates.status === "Completata"
              ? updates.completedAt || new Date().toISOString()
              : null,
        }
      : {}),
    ...(updates.assigneeId !== undefined
      ? { assigned_to: updates.assigneeId || null }
      : {}),
    ...(updates.status !== undefined
      ? {
          status:
            updates.status === "Completata"
              ? "completed"
              : updates.status === "In corso"
                ? "in_progress"
                : updates.status === "In attesa cliente" || updates.status === "Bloccata"
                  ? "waiting_client"
                  : updates.status === "Annullata"
                    ? "cancelled"
                    : "todo",
        }
      : {}),
    ...(updates.priority !== undefined
      ? {
          priority:
            updates.priority === "Urgente"
              ? "urgent"
              : updates.priority === "Alta"
                ? "high"
                : updates.priority === "Bassa"
                  ? "low"
                  : "medium",
        }
      : {}),
    ...(updates.kanbanOrder !== undefined
      ? { kanban_order: updates.kanbanOrder }
      : {}),
  });
}

export function deleteActivityOnServer(activity: CustomerActivity) {
  return activity.projectId
    ? apiFetch(`/tenant/projects/${activity.projectId}/tasks/${activity.id}`, {
        method: "DELETE",
      })
    : commercialApi.archive(
        "activity",
        activity.id,
        activity.version || 1,
        "Archiviazione attività commerciale",
      );
}

export function automationApiBody(rule: Partial<CommercialAutomationRule>) {
  return {
    ...(rule.optimisticVersion !== undefined ? { optimistic_version: rule.optimisticVersion } : {}),
    ...(rule.name !== undefined ? { name: rule.name } : {}),
    ...(rule.message !== undefined ? { description: rule.message } : {}),
    ...(rule.trigger !== undefined ? { trigger_type: rule.trigger } : {}),
    ...(rule.conditions !== undefined ? { conditions: rule.conditions } : {}),
    ...(rule.action !== undefined || rule.recipientId !== undefined || rule.message !== undefined
      ? {
          actions: [{
            type: rule.action || "create_notification",
            recipient_id: rule.recipientId,
            message: rule.message,
          }],
        }
      : {}),
    category: "general",
    run_mode: "manual",
    ...(rule.enabled !== undefined ? { is_enabled: rule.enabled } : {}),
  }
}

export function contractApiBody(contract: Partial<CommercialContract>) {
  const metadata = {
    ...(contract.orderId !== undefined && contract.orderId
      ? { order_id: contract.orderId }
      : {}),
    ...(contract.version !== undefined && contract.version
      ? { version: contract.version }
      : {}),
    ...(contract.signatoryName !== undefined && contract.signatoryName
      ? { signatory_name: contract.signatoryName }
      : {}),
    ...(contract.serviceIds !== undefined
      ? { service_ids: contract.serviceIds }
      : {}),
  };
  return {
    ...(contract.id !== undefined ? { id: contract.id } : {}),
    ...(contract.code !== undefined ? { contract_number: contract.code } : {}),
    ...(contract.title !== undefined ? { title: contract.title } : {}),
    ...(contract.customerId !== undefined ? { company_id: contract.customerId } : {}),
    ...(contract.leadId !== undefined ? { opportunity_id: contract.leadId || null } : {}),
    ...(contract.projectId !== undefined ? { project_id: contract.projectId || null } : {}),
    ...(contract.quoteId !== undefined ? { quote_id: contract.quoteId || null } : {}),
    ...(contract.salespersonId !== undefined ? { owner_user_id: contract.salespersonId } : {}),
    ...(contract.signatureDueAt !== undefined ? { due_date: contract.signatureDueAt || null } : {}),
    ...(contract.signedAt !== undefined ? { signed_at: contract.signedAt || null } : {}),
    ...(contract.sentAt !== undefined ? { sent_at: contract.sentAt || null } : {}),
    ...(contract.notes !== undefined ? { internal_notes: contract.notes || null } : {}),
    ...(contract.status !== undefined ? {
      status: contract.status === "Firmato" ? "signed" : contract.status === "In attesa di firma" || contract.status === "Inviato" ? "sent" : contract.status === "Archiviato" ? "archived" : "draft",
      signature_status: contract.status === "Firmato" ? "completed" : contract.status === "In attesa di firma" ? "client_pending" : "not_started",
    } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  }
}

export function textValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}
export function numericValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
export function dateValue(value: unknown, fallback = new Date(0).toISOString()) {
  const raw = textValue(value);
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toISOString()
    : fallback;
}
export function serverComment(
  comment: Record<string, unknown> & { id: string },
): CommercialComment {
  return {
    id: comment.id,
    recordType: textValue(
      comment.record_type,
    ) as CommercialComment["recordType"],
    recordId: textValue(comment.record_id),
    parentCommentId: textValue(comment.parent_comment_id) || undefined,
    authorId: textValue(comment.author_id),
    text: textValue(comment.body),
    mentionUserIds: Array.isArray(comment.mention_user_ids)
      ? comment.mention_user_ids.map(String)
      : [],
    attachments: Array.isArray(comment.attachments)
      ? comment.attachments.map((attachment: Record<string, unknown>) => ({
          id: textValue(attachment.id),
          name: textValue(attachment.name),
          mimeType: textValue(attachment.mime_type),
          size: numericValue(attachment.size),
          reference: textValue(attachment.document_id)
            ? `document:${textValue(attachment.document_id)}`
            : textValue(attachment.storage_reference) || undefined,
        }))
      : [],
    reactions: Array.isArray(comment.reactions)
      ? comment.reactions.map((reaction: Record<string, unknown>) => ({
          emoji: textValue(reaction.emoji),
          userIds: Array.isArray(reaction.user_ids)
            ? reaction.user_ids.map(String)
            : [],
        }))
      : [],
    createdAt: dateValue(comment.created_at),
    updatedAt: dateValue(comment.updated_at, dateValue(comment.created_at)),
    resolvedAt: comment.resolved_at
      ? dateValue(comment.resolved_at)
      : undefined,
    resolvedBy: textValue(comment.resolved_by) || undefined,
    deletedAt: comment.deleted_at ? dateValue(comment.deleted_at) : undefined,
    optimisticVersion: numericValue(comment.optimistic_version) || 1,
  };
}
export function leadSource(value: unknown): CommercialLead["source"] {
  const raw = textValue(value).toLowerCase();
  if (raw.includes("google")) return "Google Ads";
  if (raw.includes("meta") || raw.includes("facebook")) return "Meta Ads";
  if (raw.includes("linkedin")) return "LinkedIn";
  if (raw.includes("referr")) return "Referral";
  if (raw.includes("evento")) return "Evento";
  if (raw.includes("instagram")) return "Instagram";
  if (raw.includes("organic") || raw.includes("organico")) return "Organico";
  return "Manuale";
}

export function mapOpportunity(
  opportunity: CommercialOpportunity,
  ownerName: string,
): CommercialLead {
  const stage = normalizePipelineStage(opportunity.ui_stage || opportunity.stage);
  const contactParts = textValue(opportunity.contact_name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const createdAt = dateValue(opportunity.created_at);
  const updatedAt = dateValue(opportunity.updated_at, createdAt);
  return {
    id: opportunity.id,
    version: opportunity.version,
    opportunityName: opportunity.title,
    firstName: contactParts[0] || "",
    lastName: contactParts.slice(1).join(" "),
    company: textValue(opportunity.company_name) || opportunity.title,
    email: textValue(opportunity.contact_email),
    phone: textValue(opportunity.contact_phone),
    source: leadSource(opportunity.lead_source),
    service: textValue(opportunity.service_type || opportunity.lead_interest),
    stage,
    status: stage,
    value: numericValue(opportunity.value_estimate),
    probability: Number.isFinite(Number(opportunity.probability))
      ? Number(opportunity.probability)
      : (pipelineStages.find((item) => item.id === stage)?.probability ?? 0),
    assigneeId: textValue(opportunity.assigned_to),
    owner: ownerName,
    createdAt,
    lastContact: updatedAt,
    nextAction: textValue(opportunity.next_action),
    nextActionAt: dateValue(opportunity.next_action_at, ""),
    daysInStage: Math.max(
      0,
      Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000),
    ),
    convertedClientId: opportunity.converted_company_id || undefined,
    convertedAt: opportunity.converted_at || undefined,
    archivedAt: opportunity.deleted_at || undefined,
    mergedIntoId: opportunity.merged_into_id || undefined,
  };
}

export function opportunityPayload(input: Partial<CommercialLead>) {
  return {
    ...(input.version !== undefined ? { version: input.version } : {}),
    ...(input.opportunityName !== undefined || input.company !== undefined
      ? { title: input.opportunityName || input.company }
      : {}),
    ...(input.service !== undefined ? { service_type: input.service } : {}),
    ...(input.source !== undefined ? { lead_source: input.source } : {}),
    ...(input.value !== undefined ? { value_estimate: input.value } : {}),
    ...(input.probability !== undefined
      ? { probability: input.probability }
      : {}),
    ...(input.stage !== undefined || input.status !== undefined
      ? { stage: input.stage || input.status }
      : {}),
    ...(input.assigneeId !== undefined
      ? { assigned_to: input.assigneeId || null }
      : {}),
    ...(input.nextAction !== undefined
      ? { next_action: input.nextAction }
      : {}),
    ...(input.nextActionAt !== undefined
      ? { next_action_at: input.nextActionAt || null }
      : {}),
  };
}
