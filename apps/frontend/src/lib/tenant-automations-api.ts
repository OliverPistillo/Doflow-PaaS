"use client";

import { apiFetch } from "@/lib/api";

export type ListResponse<T> = { items: T[]; total?: number; limit?: number; offset?: number };
export type AutomationParams = Record<string, string | number | boolean | null | undefined>;

export type AutomationSummary = {
  totalRules: number;
  enabledRules: number;
  failedRunsToday: number;
  successfulRunsToday: number;
  actionsToday: number;
  lastRunAt?: string | null;
  dueRules: number;
  automationRisksCount: number;
  sources?: Record<string, boolean>;
};

export type AutomationTemplate = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  category: string;
  trigger_type: string;
  default_conditions?: unknown;
  default_actions?: unknown[];
  default_schedule?: unknown;
  is_active?: boolean;
  is_system?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AutomationRule = {
  id: string;
  template_id?: string | null;
  name: string;
  description?: string | null;
  category: string;
  trigger_type: string;
  trigger_config?: unknown;
  conditions?: unknown;
  actions?: unknown[];
  schedule_config?: unknown;
  is_enabled: boolean;
  run_mode: string;
  priority: string;
  cooldown_minutes?: number;
  max_runs_per_day?: number;
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_success_at?: string | null;
  last_error_at?: string | null;
  last_error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AutomationRun = {
  id: string;
  rule_id?: string | null;
  rule_name?: string | null;
  trigger_type: string;
  trigger_source?: string | null;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  matched_count?: number;
  actions_count?: number;
  actions_success_count?: number;
  actions_failed_count?: number;
  skipped_reason?: string | null;
  error_message?: string | null;
  input_payload?: unknown;
  result_payload?: unknown;
  actor_user_id?: string | null;
};

export type AutomationActionLog = {
  id: string;
  run_id: string;
  rule_id?: string | null;
  action_type: string;
  status: string;
  target_entity_type?: string | null;
  target_entity_id?: string | null;
  dedupe_key?: string | null;
  message?: string | null;
  error_message?: string | null;
  payload?: unknown;
  created_at?: string | null;
};

export type AutomationDedupeEntry = {
  id: string;
  rule_id?: string | null;
  dedupe_key: string;
  entity_type?: string | null;
  entity_id?: string | null;
  action_type?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  expires_at?: string | null;
  hit_count?: number;
};

export type AutomationActivity = {
  id: string;
  action: string;
  rule_id?: string | null;
  template_id?: string | null;
  actor_user_id?: string | null;
  metadata?: unknown;
  created_at?: string | null;
};

export type AutomationOptions = {
  triggers: string[];
  conditions: string[];
  actions: string[];
  categories: string[];
  runModes: string[];
  runStatuses: string[];
  priorities: string[];
  scheduleFrequencies: string[];
};

export type CreateAutomationRuleInput = Partial<AutomationRule>;
export type UpdateAutomationRuleInput = Partial<AutomationRule>;

function qs(params?: AutomationParams) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "__all__") return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const automationsApi = {
  summary: () => apiFetch<AutomationSummary>("/tenant/automations/summary"),
  options: () => apiFetch<AutomationOptions>("/tenant/automations/options"),
  templates: (params?: AutomationParams) => apiFetch<ListResponse<AutomationTemplate>>(`/tenant/automations/templates${qs(params)}`),
  seedTemplates: () => apiFetch<{ success: boolean; templatesSeeded?: boolean; rulesSeeded?: boolean }>("/tenant/automations/templates/seed-base", { method: "POST", body: JSON.stringify({}) }),
  template: (templateId: string) => apiFetch<AutomationTemplate>(`/tenant/automations/templates/${templateId}`),
  rules: (params?: AutomationParams) => apiFetch<ListResponse<AutomationRule>>(`/tenant/automations/rules${qs(params)}`),
  createRule: (body: CreateAutomationRuleInput) => apiFetch<AutomationRule>("/tenant/automations/rules", { method: "POST", body: JSON.stringify(body) }),
  rule: (ruleId: string) => apiFetch<AutomationRule>(`/tenant/automations/rules/${ruleId}`),
  updateRule: (ruleId: string, body: UpdateAutomationRuleInput) => apiFetch<AutomationRule>(`/tenant/automations/rules/${ruleId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteRule: (ruleId: string) => apiFetch<{ success: boolean }>(`/tenant/automations/rules/${ruleId}`, { method: "DELETE" }),
  enableRule: (ruleId: string) => apiFetch<AutomationRule>(`/tenant/automations/rules/${ruleId}/enable`, { method: "PATCH", body: JSON.stringify({}) }),
  disableRule: (ruleId: string) => apiFetch<AutomationRule>(`/tenant/automations/rules/${ruleId}/disable`, { method: "PATCH", body: JSON.stringify({}) }),
  runRule: (ruleId: string, body: Record<string, unknown> = {}) => apiFetch<AutomationRun | Record<string, unknown>>(`/tenant/automations/rules/${ruleId}/run`, { method: "POST", body: JSON.stringify(body) }),
  ruleRuns: (ruleId: string, params?: AutomationParams) => apiFetch<ListResponse<AutomationRun>>(`/tenant/automations/rules/${ruleId}/runs${qs(params)}`),
  exportRule: (ruleId: string) => apiFetch<Record<string, unknown>>(`/tenant/automations/rules/${ruleId}/export`),
  runDue: () => apiFetch<Record<string, unknown>>("/tenant/automations/run-due", { method: "POST", body: JSON.stringify({}) }),
  runTrigger: (triggerType: string, body: Record<string, unknown> = {}) => apiFetch<Record<string, unknown>>(`/tenant/automations/run-trigger/${triggerType}`, { method: "POST", body: JSON.stringify(body) }),
  runs: (params?: AutomationParams) => apiFetch<ListResponse<AutomationRun>>(`/tenant/automations/runs${qs(params)}`),
  run: (runId: string) => apiFetch<AutomationRun>(`/tenant/automations/runs/${runId}`),
  runActions: (runId: string) => apiFetch<ListResponse<AutomationActionLog>>(`/tenant/automations/runs/${runId}/actions`),
  exportRun: (runId: string) => apiFetch<Record<string, unknown>>(`/tenant/automations/runs/${runId}/export`),
  activity: (params?: AutomationParams) => apiFetch<ListResponse<AutomationActivity>>(`/tenant/automations/activity${qs(params)}`),
  dedupe: (params?: AutomationParams) => apiFetch<ListResponse<AutomationDedupeEntry>>(`/tenant/automations/dedupe${qs(params)}`),
  deleteDedupe: (dedupeId: string) => apiFetch<{ success: boolean }>(`/tenant/automations/dedupe/${dedupeId}`, { method: "DELETE" }),
};
