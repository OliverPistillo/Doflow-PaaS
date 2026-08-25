export const collaborationRecordTypes = ["lead", "customer", "activity", "project", "quote", "contract", "order", "payment", "invoice", "renewal", "document", "builder"] as const
export type CollaborationRecordType = (typeof collaborationRecordTypes)[number]

export type CommercialAuditOrigin = "manual" | "kanban" | "automation" | "merge" | "system"

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
}

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
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  resolvedBy?: string
  deletedAt?: string
  optimisticVersion: number
}

export type PointRule = "on_time" | "early" | "late" | "qa_first_pass" | "qa_rejected" | "reopened" | "project_delivered" | "sale_collected" | "refund" | "manual_adjustment"
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
  status: "provisional" | "approved" | "reversed"
  reason: string
  reversesEntryId?: string
  createdBy: string
}

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
}

export const defaultPointPolicy: PointPolicy = { onTimeBase: 10, earlyPerDay: 2, earlyMaximum: 10, latePerDay: 2, lateMaximum: 20, qaFirstPass: 8, qaRejected: -5, reopened: -5, deliveredProject: 25, collectedPerHundredEuro: 1 }

export function auditValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—"
  if (Array.isArray(value)) return value.join(", ") || "—"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export function commentNotificationId(commentId: string, userId: string, kind: "mention" | "reply") {
  return `comment:${kind}:${commentId}:${userId}`
}
