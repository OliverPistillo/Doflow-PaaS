"use client";

import { apiFetch } from "@/lib/api";

export type ReportPeriod = {
  dateFrom?: string;
  dateTo?: string;
  groupBy?: "day" | "week" | "month" | "quarter";
};

export type ReportPermissions = {
  canViewFinance?: boolean;
  canViewCosts?: boolean;
  canManageReports?: boolean;
};

export type KpiTarget = {
  id: string;
  kpi_key?: string;
  kpiKey?: string;
  label: string;
  target_value?: number | string;
  target?: number | string;
  actual?: number | string;
  period?: string;
  applies_to_role?: string | null;
  applies_to_user_id?: string | null;
  progressPercent?: number;
  status?: string;
  lowerIsBetter?: boolean;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ReportSnapshot = {
  id: string;
  report_key: string;
  title: string;
  period_from?: string | null;
  period_to?: string | null;
  generated_by?: string | null;
  payload?: Record<string, unknown>;
  created_at?: string | null;
};

export type ReportSavedView = {
  id: string;
  name: string;
  description?: string | null;
  report_key: string;
  filters?: Record<string, unknown> | null;
  visibility: string;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ReportSummary = {
  tenant?: Record<string, unknown>;
  user?: { role?: string; canViewFinance?: boolean };
  period?: ReportPeriod;
  reportsAvailable?: string[];
  kpiTargetsConfigured?: number;
  executiveRisksCount?: number;
  lastSnapshotAt?: string | null;
  currentMonthRevenue?: number;
  currentMonthNewLeads?: number;
  currentMonthAcceptedQuotes?: number;
  currentMonthOverdueTasks?: number;
};

export type ExecutiveReport = Record<string, any> & {
  permissions?: ReportPermissions;
  sales?: Record<string, any>;
  projects?: Record<string, any>;
  finance?: Record<string, any> | null;
  team?: Record<string, any>;
  documents?: Record<string, any>;
  operations?: Record<string, any>;
  customers?: Record<string, any>;
  targets?: KpiTarget[];
  risks?: Record<string, any>[];
};

export type SalesReport = Record<string, any>;
export type ProjectsReport = Record<string, any>;
export type FinanceReport = Record<string, any>;
export type TeamReport = Record<string, any>;
export type DocumentsReport = Record<string, any>;
export type OperationsReport = Record<string, any>;
export type CustomersReport = Record<string, any>;
export type CompareReport = Record<string, any>;

export type ListResponse<T> = { items: T[]; total?: number; limit?: number; offset?: number };
export type ReportKey = "executive" | "sales" | "projects" | "finance" | "team" | "documents" | "operations" | "customers";
export type ReportParams = Record<string, string | number | boolean | null | undefined>;

function qs(params?: ReportParams) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "__all__") return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const reportsApi = {
  summary: (params?: ReportParams) => apiFetch<ReportSummary>(`/tenant/reports/summary${qs(params)}`),
  executive: (params?: ReportParams) => apiFetch<ExecutiveReport>(`/tenant/reports/executive${qs(params)}`),
  sales: (params?: ReportParams) => apiFetch<SalesReport>(`/tenant/reports/sales${qs(params)}`),
  projects: (params?: ReportParams) => apiFetch<ProjectsReport>(`/tenant/reports/projects${qs(params)}`),
  finance: (params?: ReportParams) => apiFetch<FinanceReport>(`/tenant/reports/finance${qs(params)}`),
  team: (params?: ReportParams) => apiFetch<TeamReport>(`/tenant/reports/team${qs(params)}`),
  documents: (params?: ReportParams) => apiFetch<DocumentsReport>(`/tenant/reports/documents${qs(params)}`),
  operations: (params?: ReportParams) => apiFetch<OperationsReport>(`/tenant/reports/operations${qs(params)}`),
  customers: (params?: ReportParams) => apiFetch<CustomersReport>(`/tenant/reports/customers${qs(params)}`),
  compare: (params?: ReportParams) => apiFetch<CompareReport>(`/tenant/reports/compare${qs(params)}`),
  targets: (params?: ReportParams) => apiFetch<ListResponse<KpiTarget>>(`/tenant/reports/targets${qs(params)}`),
  createTarget: (body: Partial<KpiTarget>) => apiFetch<KpiTarget>("/tenant/reports/targets", { method: "POST", body: JSON.stringify(body) }),
  updateTarget: (id: string, body: Partial<KpiTarget>) => apiFetch<KpiTarget>(`/tenant/reports/targets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTarget: (id: string) => apiFetch<{ success: boolean }>(`/tenant/reports/targets/${id}`, { method: "DELETE" }),
  savedViews: (params?: ReportParams) => apiFetch<ListResponse<ReportSavedView>>(`/tenant/reports/saved-views${qs(params)}`),
  createSavedView: (body: Partial<ReportSavedView>) => apiFetch<ReportSavedView>("/tenant/reports/saved-views", { method: "POST", body: JSON.stringify(body) }),
  updateSavedView: (id: string, body: Partial<ReportSavedView>) => apiFetch<ReportSavedView>(`/tenant/reports/saved-views/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSavedView: (id: string) => apiFetch<{ success: boolean }>(`/tenant/reports/saved-views/${id}`, { method: "DELETE" }),
  snapshots: (params?: ReportParams) => apiFetch<ListResponse<ReportSnapshot>>(`/tenant/reports/snapshots${qs(params)}`),
  createSnapshot: (body: Partial<ReportSnapshot> & ReportParams) => apiFetch<ReportSnapshot>("/tenant/reports/snapshots", { method: "POST", body: JSON.stringify(body) }),
  snapshot: (id: string) => apiFetch<ReportSnapshot>(`/tenant/reports/snapshots/${id}`),
  deleteSnapshot: (id: string) => apiFetch<{ success: boolean }>(`/tenant/reports/snapshots/${id}`, { method: "DELETE" }),
  exportReport: (reportKey: string, params?: ReportParams) => apiFetch<{ reportKey: string; format: "json" | "csv"; payload?: unknown; csv?: string }>(`/tenant/reports/${reportKey}/export${qs(params)}`),
};

