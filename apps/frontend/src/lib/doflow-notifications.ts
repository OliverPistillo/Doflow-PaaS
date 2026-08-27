import type { TenantNotification } from "@/lib/tenant-notifications-api"

export type DoFlowNotification = {
  id: string
  type: "activity" | "deadline" | "project" | "client" | "lead" | "support" | "comment" | "system"
  severity: "info" | "warning" | "urgent"
  title: string
  description: string
  occurredAt: string
  entityType: "activity" | "project" | "client" | "lead" | "support"
  entityId: string
  href: string
  clientId?: string
  projectId?: string
  activityId?: string
  dueDate?: string
  commentId?: string
  read: boolean
  archived: boolean
}

function presentationType(notification: TenantNotification): DoFlowNotification["type"] {
  if (notification.type.startsWith("comment_")) return "comment"
  if (/deadline|due|overdue|expir/i.test(notification.type)) return "deadline"
  const entity = String(notification.entity_type || "").toLowerCase()
  if (entity === "activity" || entity === "task") return "activity"
  if (entity === "project") return "project"
  if (entity === "customer" || entity === "company") return "client"
  if (entity === "lead" || entity === "opportunity") return "lead"
  if (entity === "support" || entity === "support_ticket") return "support"
  return "system"
}

export function mapTenantNotification(notification: TenantNotification): DoFlowNotification {
  const priority = String(notification.priority || "medium")
  const entityType = String(notification.entity_type || "system").toLowerCase()
  return {
    id: notification.id,
    type: presentationType(notification),
    severity: priority === "urgent" || priority === "high" ? "urgent" : priority === "medium" ? "warning" : "info",
    title: notification.title,
    description: notification.body || "",
    occurredAt: notification.created_at,
    entityType: entityType === "customer" || entityType === "company" ? "client" : entityType === "task" ? "activity" : entityType === "support_ticket" ? "support" : (["activity", "project", "client", "lead", "support"].includes(entityType) ? entityType : "lead") as DoFlowNotification["entityType"],
    entityId: String(notification.entity_id || ""),
    href: notification.link_url || "/dashboard/notifiche",
    commentId: typeof notification.comment_id === "string" ? notification.comment_id : undefined,
    read: notification.status === "read",
    archived: notification.status === "archived",
  }
}

export function mapTenantNotifications(notifications: TenantNotification[]) {
  const order = { urgent: 0, warning: 1, info: 2 }
  return notifications.map(mapTenantNotification).sort((a, b) => order[a.severity] - order[b.severity] || new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}
