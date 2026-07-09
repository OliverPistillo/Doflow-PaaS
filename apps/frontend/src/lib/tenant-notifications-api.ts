"use client";

import { apiFetch } from "@/lib/api";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";
export type NotificationStatus = "unread" | "read" | "archived";

export type TenantNotification = {
  id: string;
  recipient_user_id?: string | null;
  recipient_role?: string | null;
  title: string;
  body?: string | null;
  type: string;
  priority: NotificationPriority | string;
  status: NotificationStatus | string;
  entity_type?: string | null;
  entity_id?: string | null;
  link_url?: string | null;
  fingerprint?: string | null;
  metadata?: Record<string, unknown> | null;
  read_at?: string | null;
  archived_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
};

export type NotificationSummary = {
  unreadNotifications: number;
  urgentNotifications: number;
  taskOverdueNotifications: number;
  assignedTaskNotifications: number;
  financeNotifications: number;
  todayDigestAvailable: boolean;
};

export type NotificationRule = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  category: string;
  is_enabled: boolean;
  severity: NotificationPriority | string;
  target_roles?: string[] | null;
  config?: Record<string, unknown> | null;
  last_run_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type NotificationRuleRunResult = {
  ruleKey?: string;
  rule_key?: string;
  status: "success" | "failed" | "skipped" | string;
  notificationsCreated?: number;
  notifications_created?: number;
  errorMessage?: string;
  error_message?: string;
};

export type NotificationRuleRunResponse = {
  results: NotificationRuleRunResult[];
  notificationsCreated?: number;
  notifications_created?: number;
};

export type NotificationPreferences = {
  id?: string;
  user_id?: string;
  muted_types?: string[] | null;
  muted_priorities?: string[] | null;
  daily_digest_enabled: boolean;
  digest_time?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type NotificationDigest = {
  id: string;
  user_id?: string | null;
  role?: string | null;
  digest_date: string;
  status: string;
  title: string;
  summary?: Record<string, unknown> | unknown[] | null;
  notification_ids?: string[] | null;
  created_at?: string | null;
  read_at?: string | null;
};

export type ListResponse<T> = {
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
};

type QueryParams = Record<string, string | number | boolean | null | undefined>;

function queryString(params?: QueryParams): string {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "__all__") return;
    qs.set(key, String(value));
  });
  const text = qs.toString();
  return text ? `?${text}` : "";
}

export function listTenantNotifications(params?: QueryParams) {
  return apiFetch<ListResponse<TenantNotification>>(`/tenant/notifications${queryString(params)}`);
}

export function getTenantNotificationSummary() {
  return apiFetch<NotificationSummary>("/tenant/notifications/summary");
}

export function getTenantNotification(id: string) {
  return apiFetch<TenantNotification>(`/tenant/notifications/${id}`);
}

export function markTenantNotificationRead(id: string) {
  return apiFetch<TenantNotification>(`/tenant/notifications/${id}/read`, { method: "PATCH" });
}

export function markTenantNotificationUnread(id: string) {
  return apiFetch<TenantNotification>(`/tenant/notifications/${id}/unread`, { method: "PATCH" });
}

export function archiveTenantNotification(id: string) {
  return apiFetch<TenantNotification>(`/tenant/notifications/${id}/archive`, { method: "PATCH" });
}

export function deleteTenantNotification(id: string) {
  return apiFetch<{ success: boolean }>(`/tenant/notifications/${id}`, { method: "DELETE" });
}

export function markAllTenantNotificationsRead() {
  return apiFetch<{ updated: number }>("/tenant/notifications/mark-all-read", { method: "PATCH" });
}

export function listNotificationRules() {
  return apiFetch<ListResponse<NotificationRule>>("/tenant/notifications/rules");
}

export function updateNotificationRule(key: string, body: Partial<Pick<NotificationRule, "is_enabled" | "severity" | "target_roles" | "config">>) {
  return apiFetch<NotificationRule>(`/tenant/notifications/rules/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function runNotificationRules() {
  return apiFetch<NotificationRuleRunResponse>("/tenant/notifications/rules/run", { method: "POST" });
}

export function runNotificationRule(key: string) {
  return apiFetch<NotificationRuleRunResponse>(`/tenant/notifications/rules/${encodeURIComponent(key)}/run`, { method: "POST" });
}

export function getNotificationPreferences() {
  return apiFetch<NotificationPreferences>("/tenant/notifications/preferences");
}

export function updateNotificationPreferences(body: Partial<NotificationPreferences>) {
  return apiFetch<NotificationPreferences>("/tenant/notifications/preferences", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function listNotificationDigests() {
  return apiFetch<ListResponse<NotificationDigest>>("/tenant/notifications/digests");
}

export function getTodayNotificationDigest() {
  return apiFetch<NotificationDigest | null>("/tenant/notifications/digests/today");
}

export function generateNotificationDigest() {
  return apiFetch<NotificationDigest | { generated: number }>("/tenant/notifications/digests/generate", { method: "POST" });
}
