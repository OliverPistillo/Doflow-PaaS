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

export type ReportMetricMap = Record<string, unknown>;
export type ReportRow = Record<string, unknown>;

export type SalesReportSection = {
  openLeads?: unknown;
  newLeadsInPeriod?: unknown;
  activeOpportunities?: unknown;
  pipelineValue?: unknown;
  acceptedQuotes?: unknown;
  quoteAcceptanceRate?: unknown;
  followUpsDue?: unknown;
  leadCountByStatus?: ReportMetricMap;
  leadCountBySource?: ReportMetricMap;
  opportunitiesByStage?: ReportMetricMap;
  pipelineValueByStage?: ReportMetricMap;
  quoteCountByStatus?: ReportMetricMap;
  quoteValueByStatus?: ReportMetricMap;
  topOpportunities?: ReportRow[];
  stagnantOpportunities?: ReportRow[];
  commercialActivities?: ReportMetricMap;
};

export type ProjectsReportSection = {
  activeProjects?: unknown;
  completedProjects?: unknown;
  lateProjects?: unknown;
  blockedProjects?: unknown;
  overdueTasks?: unknown;
  dueSoonTasks?: unknown;
  upcomingMilestones?: unknown;
  projectDeliveryRate?: unknown;
  projectsByStatus?: Record<string, number>;
  tasksByStatus?: ReportMetricMap;
  milestonesByStatus?: ReportMetricMap;
  projectRisks?: ReportRow[];
  workloadByProject?: ReportRow[];
};

export type FinanceReportSection = {
  issuedInvoices?: unknown;
  issuedInvoiceValue?: unknown;
  paidInvoices?: unknown;
  paidInvoiceValue?: unknown;
  overdueInvoices?: unknown;
  receivables?: unknown;
  paymentsInPeriod?: unknown;
  estimatedMargin?: unknown;
  invoicesByStatus?: ReportMetricMap;
  paymentsByMonth?: ReportRow[];
  projectFinancialStatus?: ReportMetricMap;
  topUnpaidInvoices?: ReportRow[];
};

export type TeamReportSection = {
  overloadedMembers?: unknown;
  estimatedInternalCost?: unknown;
  membersByStatus?: ReportMetricMap;
  availabilityDistribution?: ReportMetricMap;
  workloadDistribution?: ReportMetricMap;
  loggedHoursByActivityType?: ReportMetricMap;
  timeEntriesByStatus?: ReportMetricMap;
  loggedHoursByMember?: ReportRow[];
  capacityVsLoggedHours?: ReportRow[];
};

export type DocumentsReportSection = {
  totalDocuments?: unknown;
  documentsUploadedInPeriod?: unknown;
  archivedDocuments?: unknown;
  financeDocuments?: unknown;
  storageUsedBytes?: unknown;
  documentsByCategory?: ReportMetricMap;
  documentsByVisibility?: ReportMetricMap;
  documentsByEntityType?: ReportMetricMap;
  recentUploads?: ReportRow[];
};

export type OperationsReportSection = {
  unreadNotifications?: unknown;
  urgentNotifications?: unknown;
  incompleteBriefings?: unknown;
  missingMaterials?: unknown;
  overdueTasks?: unknown;
  blockedProjects?: unknown;
  staleQuotes?: unknown;
  notificationsByType?: ReportMetricMap;
  notificationRulesStatus?: ReportMetricMap;
  openRisks?: ReportRow[];
};

export type CustomersReportSection = {
  activeCustomers?: unknown;
  prospects?: unknown;
  dormantCustomers?: unknown;
  customersWithActiveProjects?: unknown;
  customersWithRecurringServices?: unknown;
  customersWithUpcomingRenewals?: unknown;
  customersWithUnpaidInvoices?: unknown;
  companiesByStatus?: ReportMetricMap;
  upsellCandidates?: ReportRow[];
};

export type ExecutiveReport = {
  permissions?: ReportPermissions;
  sales?: SalesReportSection;
  projects?: ProjectsReportSection;
  finance?: FinanceReportSection | null;
  team?: TeamReportSection;
  documents?: DocumentsReportSection;
  operations?: OperationsReportSection;
  customers?: CustomersReportSection;
  targets?: KpiTarget[];
  risks?: ReportRow[];
};

export type SalesReport = SalesReportSection & { sales?: SalesReportSection };
export type ProjectsReport = ProjectsReportSection & { projects?: ProjectsReportSection };
export type FinanceReport = FinanceReportSection & { finance?: FinanceReportSection };
export type TeamReport = TeamReportSection & { team?: TeamReportSection };
export type ConsultantPerformanceItem = {
  user_id: string;
  display_name: string;
  operational_role?: string | null;
  opportunities_assigned: number;
  activities_completed: number;
  follow_ups_overdue: number;
  appointments: number;
  calls: number;
  won: number;
  lost: number;
  won_value?: number;
  conversion_rate: number;
  projects_managed: number;
  tasks_assigned: number;
  tasks_completed: number;
  tasks_overdue: number;
  task_completion_rate: number;
  projects_delivered: number;
  projects_late: number;
  timeline_created: number;
  timeline_completed: number;
  average_activity_close_hours?: number | null;
  open_workload: number;
};
export type ConsultantPerformanceReport = {
  period: { dateFrom: string; dateTo: string };
  permissions: { canViewFinance: boolean };
  criteria: Record<string, string>;
  summary: Record<string, number>;
  items: ConsultantPerformanceItem[];
  details?: {
    activities: Array<{ id: string; title?: string | null; type?: string | null; completed_at?: string | null; created_at?: string | null }>;
    projects: Array<{ id: string; name?: string | null; company_name?: string | null; status?: string | null }>;
    opportunities: Array<{ id: string; title?: string | null; company_name?: string | null; stage?: string | null }>;
  };
};
export type DocumentsReport = DocumentsReportSection & { documents?: DocumentsReportSection };
export type OperationsReport = OperationsReportSection & { operations?: OperationsReportSection };
export type CustomersReport = CustomersReportSection & { customers?: CustomersReportSection };
export type CompareReport = Record<string, unknown>;

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
  consultantPerformance: (params?: ReportParams) => apiFetch<ConsultantPerformanceReport>(`/tenant/reports/consultant-performance${qs(params)}`),
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
