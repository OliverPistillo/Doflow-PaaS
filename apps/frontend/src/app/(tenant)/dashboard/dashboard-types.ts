export type DashboardActivityItem = {
  title: string;
  meta?: string | null;
  createdAt?: string | null;
};

export type DashboardSummary = {
  user?: {
    id?: string;
    email?: string;
    role?: string;
    dashboardAudience?: "executive" | "manager" | "employee";
    canViewFinance?: boolean;
  };
  sales?: {
    openLeads?: number;
    activeOpportunities?: number;
    pipelineValue?: number;
    sentQuotes?: number;
    acceptedQuotes?: number;
    rejectedQuotes?: number;
    acceptedQuoteValue?: number;
    wonDeals?: number;
    lostDeals?: number;
  } | null;
  projects?: {
    activeProjects?: number;
    assignedProjects?: number;
    lateProjects?: number;
    blockedProjects?: number;
    upcomingMilestones?: number;
    upcomingDeliveries?: number;
    blockedTasks?: number;
    dueTasks?: number;
  } | null;
  finance?: {
    issuedInvoices?: number;
    receivables?: number;
    overdueInvoices?: number;
    balanceToRequest?: number;
    paymentsThisMonth?: number;
    totalOutstanding?: number;
  } | null;
  team?: {
    overdueTasks?: number;
    openTasks?: number;
    blockedTasks?: number;
  } | null;
  personal?: {
    myTasks?: number;
    dueSoon?: number;
    blockedTasks?: number;
    assignedProjects?: number;
    upcomingDeadlines?: number;
  };
  operations?: {
    unreadNotifications?: number;
    urgentNotifications?: number;
    upcomingDeliveries?: number;
    notifications?: DashboardActivityItem[];
    reportsSummary?: {
      currentMonthRevenue?: number;
    } | null;
  };
};

export type DashboardProject = {
  id: string;
  name: string;
  status?: string | null;
  progress?: number | string | null;
  due_date?: string | null;
  company_name?: string | null;
};

export type DashboardTask = {
  id: string;
  title: string;
  status?: string | null;
  priority?: string | null;
  due_at?: string | null;
  due_date?: string | null;
  project_id?: string | null;
  project_name?: string | null;
};

export type RevenuePoint = {
  label: string;
  value: number;
};

export type ReportSnapshot = {
  id: string;
  created_at?: string | null;
  payload?: Record<string, unknown> | null;
};

export type ListResponse<T> = {
  items: T[];
  total?: number;
};
