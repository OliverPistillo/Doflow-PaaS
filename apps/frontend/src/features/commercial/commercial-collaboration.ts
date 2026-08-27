export const collaborationRecordTypes = ["lead", "customer", "activity", "project", "quote", "contract", "order", "payment", "invoice", "renewal", "document", "support_ticket"] as const
export type CollaborationRecordType = (typeof collaborationRecordTypes)[number]

export type CommercialAuditOrigin = "manual" | "kanban" | "automation" | "merge" | "system"
export type CommercialAuditActionType = "field_change" | "status_change" | "assignment" | "archive" | "restore" | "approval" | "rejection" | "comment" | "attachment" | "payment" | "refund" | "merge" | "create" | "soft_delete" | "points" | "system"
export type CommercialAuditChange = { field: string; oldValue?: unknown; newValue?: unknown; sensitive?: boolean }

export type CommercialAuditEvent = {
  id: string
  recordType: CollaborationRecordType
  recordId: string
  action: string
  field?: string
  previousValue?: string
  nextValue?: string
  origin: CommercialAuditOrigin
  reason?: string
  relatedRecords: Array<{ type: CollaborationRecordType; id: string }>
  authorId: string
  authorName: string
  authorAvatarUrl?: string
  createdAt: string
  sensitive?: boolean
  actionType?: CommercialAuditActionType
  actorId?: string
  groupId?: string
  operationId?: string
  changes?: CommercialAuditChange[]
  source?: CommercialAuditOrigin
  linkedRecord?: { type: CollaborationRecordType; id: string; label?: string; href?: string }
  metadata?: Record<string, string | number | boolean | null>
}

const auditFieldLabels: Record<string, string> = { nextActionAt: "Prossima azione", nextAction: "Azione pianificata", status: "Stato", stage: "Stato", assignedToId: "Responsabile", assigneeId: "Responsabile", ownerId: "Responsabile", owner: "Responsabile", probability: "Probabilità di chiusura", value: "Valore trattativa", amount: "Importo", total: "Totale", paidAmount: "Importo pagato", balance: "Residuo", service: "Servizio", serviceId: "Servizio", company: "Azienda", opportunityName: "Nome opportunità", firstName: "Nome", lastName: "Cognome", name: "Nome", title: "Titolo", description: "Descrizione", notes: "Note", location: "Sede", email: "Email", phone: "Telefono", source: "Fonte", dueAt: "Scadenza", dueDate: "Scadenza", originalDueAt: "Scadenza originale", completedAt: "Completamento", deliveryDate: "Data di consegna", priority: "Priorità", archivedAt: "Archiviazione", archivedReason: "Motivo archiviazione", supervisorId: "Supervisore", approvalStatus: "Approvazione", approvalId: "Approvazione", workStatus: "Approvazione lavoro", reopenedAt: "Data riapertura", reopenedReason: "Motivo riapertura", paymentStatus: "Stato pagamento", method: "Metodo di pagamento", paymentType: "Tipo pagamento", reference: "Riferimento", projectId: "Progetto", clientId: "Cliente", customerId: "Cliente", leadId: "Lead", collaboratorIds: "Collaboratori", memberIds: "Membri del progetto", contactId: "Referente", category: "Categoria", type: "Tipologia", startAt: "Inizio", endAt: "Fine", date: "Data", renewalAt: "Rinnovo", nextRenewalAt: "Prossimo rinnovo", contractStatus: "Stato contratto", signedAt: "Data firma", documentStatus: "Stato documento", websiteStatus: "Stato produzione", timer: "Timer", approvalOverride: "Override amministrativo", attachmentMetadata: "Allegati", contacts: "Referenti", phases: "Fasi", finance: "Amministrazione" }
export function getAuditFieldLabel(field: string) { return auditFieldLabels[field] ?? field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase()) }
export function inferAuditActionType(event: Pick<CommercialAuditEvent, "action" | "field" | "origin" | "previousValue" | "nextValue"> & { changes?: CommercialAuditChange[] }): CommercialAuditActionType { const action = event.action.toLowerCase(); const fields = (event.changes ?? []).map((change) => change.field).concat(event.field ?? []); if (event.origin === "merge" || action.includes("fusion")) return "merge"; if (action.includes("riprist")) return "restore"; if (action.includes("archiv") || fields.includes("archivedAt") && event.nextValue) return "archive"; if (action.includes("rifiut") || action.includes("correzion")) return "rejection"; if (action.includes("approv")) return "approval"; if (action.includes("rimbors")) return "refund"; if (action.includes("pagament") || fields.some((field) => ["paymentStatus", "paidAmount", "amount"].includes(field))) return "payment"; if (action.includes("punt")) return "points"; if (action.includes("creat") || action.includes("aggiunt")) return "create"; if (fields.some((field) => ["assigneeId", "assignedToId", "ownerId", "supervisorId"].includes(field))) return "assignment"; if (fields.some((field) => ["status", "stage", "workStatus", "websiteStatus", "documentStatus"].includes(field))) return "status_change"; return event.origin === "system" || event.origin === "automation" ? "system" : "field_change" }
export function normalizeAuditEvent(event: CommercialAuditEvent): CommercialAuditEvent { const rawChanges = event.changes?.length ? event.changes : event.field ? [{ field: event.field, oldValue: event.previousValue, newValue: event.nextValue, sensitive: event.sensitive }] : []; const hasAssignee = rawChanges.some((change) => change.field === "assigneeId" || change.field === "assignedToId"); const stage = rawChanges.find((change) => change.field === "stage"); const changes = rawChanges.filter((change) => !["updatedAt", "createdAt"].includes(change.field) && JSON.stringify(change.oldValue) !== JSON.stringify(change.newValue) && !(change.field === "owner" && hasAssignee) && !(change.field === "status" && stage && stage.oldValue === change.oldValue && stage.newValue === change.newValue)); return { ...event, actorId: event.actorId ?? event.authorId, source: event.source ?? event.origin, actionType: event.actionType ?? inferAuditActionType({ ...event, changes }), changes } }
export function normalizeAuditEvents(events: CommercialAuditEvent[]) { return events.map(normalizeAuditEvent) }

export type CommentAttachment = { id: string; name: string; mimeType: string; size: number; reference?: string }
export type CommentReaction = { emoji: string; userIds: string[] }

export type CommercialComment = {
  id: string
  recordType: CollaborationRecordType
  recordId: string
  parentCommentId?: string
  authorId: string
  text: string
  mentionUserIds: string[]
  attachments: CommentAttachment[]
  reactions: CommentReaction[]
  readByUserIds?: string[]
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  resolvedBy?: string
  deletedAt?: string
  optimisticVersion: number
}

export type PointRule = "on_time" | "early" | "late" | "urgent_on_time" | "qa_first_pass" | "qa_rejected" | "reopened" | "correction_approved" | "project_delivered" | "support_approved" | "support_early" | "support_sla_breach" | "appointment_qualified" | "followup_on_time" | "sale_collected" | "paying_customer" | "refund" | "manual_adjustment" | "manual_bonus" | "manual_penalty" | "redemption" | "redemption_reversal"
export type PointLedgerStatus = "provisional" | "approved" | "reversed" | "converted" | "cancelled"
export type PointCategory = "activity" | "quality" | "commercial" | "support" | "manual" | "conversion"
export type PointLedgerEntry = {
  id: string
  userId: string
  points: number
  rule: PointRule
  recordType: CollaborationRecordType
  recordId: string
  sourceEventId: string
  validDueAt?: string
  occurredAt: string
  createdAt?: string
  status: PointLedgerStatus
  reason: string
  reversesEntryId?: string
  reversalOfId?: string
  category?: PointCategory
  idempotencyKey?: string
  approvedAt?: string
  approvedBy?: string
  redemptionId?: string
  attachment?: { name: string; reference?: string }
  confidential?: boolean
  createdBy: string
}

export type PointRewardType = "voucher" | "cash_bonus" | "day_off" | "benefit"
export type PointRedemption = { id: string; idempotencyKey: string; userId: string; points: number; rewardType: PointRewardType; estimatedEuroValue: number; status: "in_review" | "approved" | "rejected" | "delivered" | "cancelled"; reason: string; requestedAt: string; decidedAt?: string; decidedBy?: string; decisionReason?: string; deliveredAt?: string; ledgerEntryId?: string }

export type PointPolicy = {
  onTimeBase: number
  earlyPerDay: number
  earlyMaximum: number
  latePerDay: number
  lateMaximum: number
  qaFirstPass: number
  qaRejected: number
  reopened: number
  deliveredProject: number
  collectedPerHundredEuro: number
  lateBasePenalty: number
  lateAdditionalPerDay: number
  approvedSupport: number
  urgentOnTimeBonus: number
  earlyTwoDayBonus: number
  earlyFiveDayBonus: number
  firstReopenPenalty: number
  secondReopenPenalty: number
  correctionRecovery: number
  supportEarlyBonus: number
  supportSlaPenalty: number
  qualifiedAppointment: number
  followupOnTime: number
  payingCustomer: number
  redemptionMinimumPoints: number
  redemptionPointsUnit: number
  redemptionEuroValue: number
  redemptionMonthlyMaximumPoints: number
  pointExpiryMonths: number
  rewardAdministratorEnabled: number
  rewardCommercialEnabled: number
  rewardDeveloperEnabled: number
  rewardProjectManagerEnabled: number
}

export const defaultPointPolicy: PointPolicy = { onTimeBase: 10, earlyPerDay: 2, earlyMaximum: 10, latePerDay: 2, lateMaximum: 20, lateBasePenalty: -5, lateAdditionalPerDay: -1, qaFirstPass: 8, qaRejected: -8, reopened: -5, deliveredProject: 25, approvedSupport: 12, collectedPerHundredEuro: 1, urgentOnTimeBonus: 4, earlyTwoDayBonus: 3, earlyFiveDayBonus: 5, firstReopenPenalty: -4, secondReopenPenalty: -6, correctionRecovery: 2, supportEarlyBonus: 3, supportSlaPenalty: -5, qualifiedAppointment: 5, followupOnTime: 3, payingCustomer: 10, redemptionMinimumPoints: 100, redemptionPointsUnit: 100, redemptionEuroValue: 10, redemptionMonthlyMaximumPoints: 1000, pointExpiryMonths: 12, rewardAdministratorEnabled: 1, rewardCommercialEnabled: 1, rewardDeveloperEnabled: 1, rewardProjectManagerEnabled: 1 }

export function auditValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—"
  if (Array.isArray(value)) return value.join(", ") || "—"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export function commentNotificationId(commentId: string, userId: string, kind: "mention" | "reply") {
  return `comment:${kind}:${commentId}:${userId}`
}
