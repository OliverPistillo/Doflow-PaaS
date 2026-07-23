"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileCheck2,
  FileText,
  FolderKanban,
  Handshake,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
  Send,
  UserPlus,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiGrid, KpiStatCard, WorkspaceSectionHeader } from "@/components/ui/workspace-ui";
import { apiFetch } from "@/lib/api";
import { getDoFlowUser } from "@/lib/jwt";
import { getTenantRoleLabel } from "@/lib/roles";
import { formatBytes as formatDocumentBytes } from "@/components/tenant-documents/document-utils";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import {
  DashboardActivityList as ActivityList,
  DashboardPriorityStrip as PriorityStrip,
  DashboardQuickActions as QuickActions,
  DashboardSectionCard as SectionCard,
  type ActivityItem,
  type DashboardMetric as Metric,
  type DashboardQuickAction as QuickAction,
  type SourceFlags,
} from "./dashboard-ui";

type DashboardAudience = "executive" | "manager" | "employee";

type DocumentsSummary = {
  totalDocuments: number;
  recentDocuments: ActivityItem[];
  projectDocuments: number;
  financeDocuments: number;
  storageUsedBytes: number;
  sources?: SourceFlags;
};

type ReportsSummary = {
  kpiTargetsConfigured: number;
  reportsAvailable: string[];
  executiveRisksCount: number;
  lastSnapshotAt: string | null;
  currentMonthRevenue?: number;
  currentMonthNewLeads: number;
  currentMonthAcceptedQuotes: number;
  currentMonthOverdueTasks: number;
  sources?: SourceFlags;
};

type ContractsSummary = {
  totalContracts: number;
  draftContracts: number;
  sentContracts: number;
  waitingSignatureContracts: number;
  signedContracts: number;
  expiringContracts: number;
  overdueContracts: number;
  recentContracts: ActivityItem[];
  sources?: SourceFlags;
};

type PaperworkSummary = {
  openDossiers: number;
  blockedDossiers: number;
  overdueDossiers: number;
  missingItems: number;
  dueSoonItems: number;
  recentDossiers: ActivityItem[];
  sources?: SourceFlags;
};

type KnowledgeSummary = {
  publishedArticles?: number;
  draftArticles?: number;
  articlesDueForReview?: number;
  totalAssets?: number;
  activeTemplates?: number;
  favoritesCount?: number;
  recentlyUpdatedCount?: number;
  systemTemplatesCount?: number;
  knowledgeRisksCount?: number;
  sources?: SourceFlags;
};

type CredentialsSummary = {
  totalCredentials?: number;
  activeCredentials?: number;
  archivedCredentials?: number;
  expiringCredentials?: number;
  renewalsDue?: number;
  rotationDue?: number;
  expiredCredentials?: number;
  sources?: SourceFlags;
};

type AutomationsSummary = {
  totalRules: number;
  enabledRules: number;
  failedRunsToday: number;
  successfulRunsToday: number;
  actionsToday: number;
  lastRunAt: string | null;
  dueRules: number;
  automationRisksCount: number;
  sources?: SourceFlags;
};

type CalendarSummary = {
  eventsToday: number;
  eventsThisWeek: number;
  overdueEvents: number;
  conflictsCount: number;
  deadlinesThisWeek: number;
  teamUnavailableToday: number;
  nextEventAt?: string | null;
  remindersDue: number;
  derivedEventsCount: number;
  sources?: SourceFlags;
};

type DashboardSummary = {
  tenant: { id?: string; slug?: string; schema: string };
  user: {
    id: string;
    email?: string;
    role: string;
    dashboardAudience: DashboardAudience;
    canViewFinance: boolean;
  };
  generatedAt: string;
  sales: {
    openLeads: number;
    activeOpportunities: number;
    pipelineValue: number;
    sentQuotes: number;
    acceptedQuotes?: number;
    rejectedQuotes?: number;
    sentQuoteValue?: number;
    acceptedQuoteValue?: number;
    followUpsDue: number;
    wonDeals: number;
    lostDeals: number;
    sources: SourceFlags;
  };
  projects: {
    activeProjects: number;
    assignedProjects: number;
    lateProjects: number;
    blockedProjects: number;
    upcomingMilestones: number;
    upcomingDeliveries: number;
    blockedTasks: number;
    dueTasks: number;
    sources: SourceFlags;
  };
  finance: null | {
    issuedInvoices: number;
    receivables: number;
    overdueInvoices: number;
    balanceToRequest: number;
    paymentsThisMonth?: number;
    totalOutstanding?: number;
    upcomingRenewals: number;
    openFinanceDeadlines?: number;
    projectsWithOpenPayments?: number;
    estimatedMargin: number;
    sources: SourceFlags;
  };
  team: {
    overdueTasks: number;
    openTasks: number;
    blockedTasks: number;
    workload: Array<{ assignee: string; openTasks: number; utilizationPercent?: number; isOverloaded?: boolean; overdueTasks?: number }>;
    blockedCollaborators: number;
    pendingInvites: number;
    activeUsers: number;
    teamMembers?: number;
    activeTeamMembers?: number;
    availableTeamMembers?: number;
    unavailableTeamMembers?: number;
    overloadedMembers?: number;
    totalCapacityHours?: number;
    loggedHoursThisWeek?: number;
    loggedHoursThisMonth?: number;
    pendingTimeEntries?: number;
    overdueTasksByTeam?: number;
    costEstimateThisMonth?: number;
    sources: SourceFlags;
  };
  customers: {
    activeCustomers: number;
    dormantCustomers: number;
    openTickets: number;
    activeMaintenance: number;
    upsellOpportunities: number;
    sources: SourceFlags;
  };
  personal: {
    myTasks: number;
    dueSoon: number;
    blockedTasks: number;
    assignedProjects: number;
    upcomingDeadlines: number;
    sources: SourceFlags;
  };
  operations: {
    missingMaterials: number;
    incompleteBriefings?: number;
    completedBriefings?: number;
    upcomingDeliveries: number;
    unreadNotifications?: number;
    urgentNotifications?: number;
    taskOverdueNotifications?: number;
    financeNotifications?: number;
    assignedTaskNotifications?: number;
    todayDigestAvailable?: boolean;
    recentComments: ActivityItem[];
    recentFiles: ActivityItem[];
    notifications: ActivityItem[];
    documentsSummary?: DocumentsSummary;
    reportsSummary?: ReportsSummary;
    contractsSummary?: ContractsSummary;
    paperworkSummary?: PaperworkSummary;
    automationsSummary?: AutomationsSummary;
    calendarSummary?: CalendarSummary;
    knowledgeSummary?: KnowledgeSummary;
    credentialsSummary?: CredentialsSummary;
    sources?: SourceFlags;
  };
};

type DashboardSummaryResponse = Omit<DashboardSummary, "sales" | "projects" | "team" | "customers" | "operations"> & {
  sales: DashboardSummary["sales"] | null;
  projects: DashboardSummary["projects"] | null;
  team: DashboardSummary["team"] | null;
  customers: DashboardSummary["customers"] | null;
  operations: Omit<
    DashboardSummary["operations"],
    | "documentsSummary"
    | "reportsSummary"
    | "contractsSummary"
    | "paperworkSummary"
    | "automationsSummary"
    | "calendarSummary"
    | "knowledgeSummary"
    | "credentialsSummary"
  > & {
    documentsSummary?: DocumentsSummary | null;
    reportsSummary?: ReportsSummary | null;
    contractsSummary?: ContractsSummary | null;
    paperworkSummary?: PaperworkSummary | null;
    automationsSummary?: AutomationsSummary | null;
    calendarSummary?: CalendarSummary | null;
    knowledgeSummary?: KnowledgeSummary | null;
    credentialsSummary?: CredentialsSummary | null;
  };
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function getFallbackSummary(): DashboardSummary {
  const user = getDoFlowUser();
  const role = (user?.role || "user").toLowerCase();
  const dashboardAudience: DashboardAudience =
    role === "owner" || role === "admin" || role === "superadmin" || role === "super_admin"
      ? "executive"
      : role === "manager"
        ? "manager"
        : "employee";

  return {
    tenant: { schema: user?.tenantSlug || user?.tenantId || "public" },
    user: {
      id: user?.sub || "",
      email: user?.email,
      role,
      dashboardAudience,
      canViewFinance: dashboardAudience === "executive",
    },
    generatedAt: new Date().toISOString(),
    sales: {
      openLeads: 0,
      activeOpportunities: 0,
      pipelineValue: 0,
      sentQuotes: 0,
      acceptedQuotes: 0,
      rejectedQuotes: 0,
      sentQuoteValue: 0,
      acceptedQuoteValue: 0,
      followUpsDue: 0,
      wonDeals: 0,
      lostDeals: 0,
      sources: {},
    },
    projects: {
      activeProjects: 0,
      assignedProjects: 0,
      lateProjects: 0,
      blockedProjects: 0,
      upcomingMilestones: 0,
      upcomingDeliveries: 0,
      blockedTasks: 0,
      dueTasks: 0,
      sources: {},
    },
    finance: dashboardAudience === "executive"
      ? {
          issuedInvoices: 0,
          receivables: 0,
          overdueInvoices: 0,
          balanceToRequest: 0,
          paymentsThisMonth: 0,
          totalOutstanding: 0,
          upcomingRenewals: 0,
          openFinanceDeadlines: 0,
          projectsWithOpenPayments: 0,
          estimatedMargin: 0,
          sources: {},
        }
      : null,
    team: {
      overdueTasks: 0,
      openTasks: 0,
      blockedTasks: 0,
      workload: [],
      blockedCollaborators: 0,
      pendingInvites: 0,
      activeUsers: 0,
      teamMembers: 0,
      activeTeamMembers: 0,
      availableTeamMembers: 0,
      unavailableTeamMembers: 0,
      overloadedMembers: 0,
      totalCapacityHours: 0,
      loggedHoursThisWeek: 0,
      loggedHoursThisMonth: 0,
      pendingTimeEntries: 0,
      overdueTasksByTeam: 0,
      sources: {},
    },
    customers: {
      activeCustomers: 0,
      dormantCustomers: 0,
      openTickets: 0,
      activeMaintenance: 0,
      upsellOpportunities: 0,
      sources: {},
    },
    personal: {
      myTasks: 0,
      dueSoon: 0,
      blockedTasks: 0,
      assignedProjects: 0,
      upcomingDeadlines: 0,
      sources: {},
    },
    operations: {
      missingMaterials: 0,
      incompleteBriefings: 0,
      completedBriefings: 0,
      upcomingDeliveries: 0,
      unreadNotifications: 0,
      urgentNotifications: 0,
      taskOverdueNotifications: 0,
      financeNotifications: 0,
      assignedTaskNotifications: 0,
      todayDigestAvailable: false,
      recentComments: [],
      recentFiles: [],
      notifications: [],
      documentsSummary: {
        totalDocuments: 0,
        recentDocuments: [],
        projectDocuments: 0,
        financeDocuments: 0,
        storageUsedBytes: 0,
        sources: {},
      },
      reportsSummary: {
        kpiTargetsConfigured: 0,
        reportsAvailable: [],
        executiveRisksCount: 0,
        lastSnapshotAt: null,
        currentMonthRevenue: 0,
        currentMonthNewLeads: 0,
        currentMonthAcceptedQuotes: 0,
        currentMonthOverdueTasks: 0,
        sources: {},
      },
      contractsSummary: {
        totalContracts: 0,
        draftContracts: 0,
        sentContracts: 0,
        waitingSignatureContracts: 0,
        signedContracts: 0,
        expiringContracts: 0,
        overdueContracts: 0,
        recentContracts: [],
        sources: {},
      },
      paperworkSummary: {
        openDossiers: 0,
        blockedDossiers: 0,
        overdueDossiers: 0,
        missingItems: 0,
        dueSoonItems: 0,
        recentDossiers: [],
        sources: {},
      },
      automationsSummary: {
        totalRules: 0,
        enabledRules: 0,
        failedRunsToday: 0,
        successfulRunsToday: 0,
        actionsToday: 0,
        lastRunAt: null,
        dueRules: 0,
        automationRisksCount: 0,
        sources: {},
      },
      calendarSummary: {
        eventsToday: 0,
        eventsThisWeek: 0,
        overdueEvents: 0,
        conflictsCount: 0,
        deadlinesThisWeek: 0,
        teamUnavailableToday: 0,
        nextEventAt: null,
        remindersDue: 0,
        derivedEventsCount: 0,
        sources: {},
      },
      knowledgeSummary: {
        publishedArticles: 0,
        draftArticles: 0,
        articlesDueForReview: 0,
        totalAssets: 0,
        activeTemplates: 0,
        favoritesCount: 0,
        recentlyUpdatedCount: 0,
        systemTemplatesCount: 0,
        knowledgeRisksCount: 0,
        sources: {},
      },
      credentialsSummary: {
        totalCredentials: 0,
        activeCredentials: 0,
        archivedCredentials: 0,
        expiringCredentials: 0,
        renewalsDue: 0,
        rotationDue: 0,
        expiredCredentials: 0,
        sources: {},
      },
      sources: {},
    },
  };
}

function normalizeDashboardSummary(input: DashboardSummaryResponse): DashboardSummary {
  const fallback = getFallbackSummary();
  const operations = input.operations || fallback.operations;

  return {
    ...fallback,
    ...input,
    tenant: { ...fallback.tenant, ...input.tenant },
    user: { ...fallback.user, ...input.user },
    sales: input.sales || fallback.sales,
    projects: input.projects || fallback.projects,
    finance: input.finance || null,
    team: input.team || fallback.team,
    customers: input.customers || fallback.customers,
    personal: { ...fallback.personal, ...input.personal },
    operations: {
      ...fallback.operations,
      ...operations,
      recentComments: operations.recentComments || [],
      recentFiles: operations.recentFiles || [],
      notifications: operations.notifications || [],
      documentsSummary: operations.documentsSummary || fallback.operations.documentsSummary,
      reportsSummary: operations.reportsSummary || fallback.operations.reportsSummary,
      contractsSummary: operations.contractsSummary || fallback.operations.contractsSummary,
      paperworkSummary: operations.paperworkSummary || fallback.operations.paperworkSummary,
      automationsSummary: operations.automationsSummary || fallback.operations.automationsSummary,
      calendarSummary: operations.calendarSummary || fallback.operations.calendarSummary,
      knowledgeSummary: operations.knowledgeSummary || fallback.operations.knowledgeSummary,
      credentialsSummary: operations.credentialsSummary || fallback.operations.credentialsSummary,
    },
  };
}

function displayName(email?: string): string {
  if (!email) return "team doflow";
  return email.split("@")[0].replace(/[._-]+/g, " ");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function DashboardClient() {
  const [rawSummary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { canView } = useTenantAccess();

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DashboardSummaryResponse>("/tenant/dashboard/summary");
      setSummary(data);
    } catch (err) {
      setSummary(getFallbackSummary() as DashboardSummaryResponse);
      setError(err instanceof Error ? err.message : "Dashboard non disponibile");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const executiveActions = useMemo<QuickAction[]>(() => ([
    { label: "Nuovo lead", href: "/leads", icon: Handshake, moduleKey: "crm" },
    { label: "Nuovo briefing", href: "/briefings/new", icon: FileText, moduleKey: "briefing" },
    { label: "Nuovo preventivo", href: "/quotes/new", icon: Send, moduleKey: "quotes" },
    { label: "Nuovo progetto", href: "/projects/new", icon: FolderKanban, moduleKey: "projects" },
    { label: "Invita dipendente", href: "/team", icon: UserPlus, moduleKey: "team" },
    { label: "Apri finance", href: "/finance", icon: Wallet, moduleKey: "finance" },
  ] satisfies QuickAction[]).filter((action) => !action.moduleKey || canView(action.moduleKey)), [canView]);

  const managerActions = useMemo<QuickAction[]>(() => ([
    { label: "Apri task", href: "/projects/tasks", icon: CheckCircle2, moduleKey: "projects" },
    { label: "Agenda", href: "/calendar/agenda", icon: CalendarDays, moduleKey: "calendar" },
    { label: "File e materiali", href: "/documents", icon: FileText, moduleKey: "documents" },
  ] satisfies QuickAction[]).filter((action) => !action.moduleKey || canView(action.moduleKey)), [canView]);

  const employeeActions = useMemo<QuickAction[]>(() => ([
    { label: "I miei task", href: "/projects/tasks", icon: CheckCircle2, moduleKey: "projects" },
    { label: "File necessari", href: "/documents", icon: FileText, moduleKey: "documents" },
    { label: "Notifiche", href: "/notifications", icon: MessageSquare, moduleKey: "notifications" },
  ] satisfies QuickAction[]).filter((action) => !action.moduleKey || canView(action.moduleKey)), [canView]);

  if (isLoading || !rawSummary) {
    return (
      <div className="flex h-full items-center justify-center" role="status" aria-label="Caricamento dashboard">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const summary = normalizeDashboardSummary(rawSummary);
  const audience = summary.user.dashboardAudience || "employee";
  const roleLabel = getTenantRoleLabel(summary.user.role);
  const isExecutive = audience === "executive";
  const isManager = audience === "manager";
  const canSeeFinance = summary.user.canViewFinance && canView("finance");

  const salesMetrics: Metric[] = [
    { label: "Lead aperti", value: summary.sales.openLeads },
    { label: "Opportunità attive", value: summary.sales.activeOpportunities },
    { label: "Valore pipeline", value: formatCurrency(summary.sales.pipelineValue) },
    { label: "Preventivi inviati", value: summary.sales.sentQuotes },
    { label: "Preventivi accettati", value: summary.sales.acceptedQuotes || 0, tone: (summary.sales.acceptedQuotes || 0) > 0 ? "success" : "default" },
    { label: "Preventivi rifiutati", value: summary.sales.rejectedQuotes || 0, tone: (summary.sales.rejectedQuotes || 0) > 0 ? "warning" : "default" },
    { label: "Valore inviati", value: formatCurrency(summary.sales.sentQuoteValue || 0), hint: "Preventivi inviati/visti" },
    { label: "Valore accettati", value: formatCurrency(summary.sales.acceptedQuoteValue || 0), tone: (summary.sales.acceptedQuoteValue || 0) > 0 ? "success" : "default" },
    { label: "Follow-up da fare", value: summary.sales.followUpsDue, tone: summary.sales.followUpsDue > 0 ? "warning" : "default" },
    { label: "Deal vinti / persi", value: `${summary.sales.wonDeals} / ${summary.sales.lostDeals}` },
  ];

  const briefingMetrics: Metric[] = [
    { label: "Briefing incompleti", value: summary.operations.incompleteBriefings || 0, tone: (summary.operations.incompleteBriefings || 0) > 0 ? "warning" : "default" },
    { label: "Briefing completati", value: summary.operations.completedBriefings || 0, tone: (summary.operations.completedBriefings || 0) > 0 ? "success" : "default" },
    { label: "Materiali mancanti", value: summary.operations.missingMaterials, tone: summary.operations.missingMaterials > 0 ? "warning" : "default" },
  ];

  const projectMetrics: Metric[] = [
    { label: "Progetti attivi", value: summary.projects.activeProjects },
    { label: "Progetti in ritardo", value: summary.projects.lateProjects, tone: summary.projects.lateProjects > 0 ? "danger" : "default" },
    { label: "Progetti bloccati", value: summary.projects.blockedProjects, tone: summary.projects.blockedProjects > 0 ? "warning" : "default" },
    { label: "Milestone prossime", value: summary.projects.upcomingMilestones },
    { label: "Consegne previste", value: summary.projects.upcomingDeliveries },
    { label: "Task bloccati", value: summary.projects.blockedTasks, tone: summary.projects.blockedTasks > 0 ? "warning" : "default" },
  ];

  const teamMetrics: Metric[] = [
    { label: "Membri team", value: summary.team.teamMembers ?? summary.team.activeUsers },
    { label: "Attivi", value: summary.team.activeTeamMembers ?? summary.team.activeUsers },
    { label: "Disponibili", value: summary.team.availableTeamMembers || 0 },
    { label: "Non disponibili", value: summary.team.unavailableTeamMembers || 0, tone: (summary.team.unavailableTeamMembers || 0) > 0 ? "warning" : "default" },
    { label: "Sovraccarichi", value: summary.team.overloadedMembers || 0, tone: (summary.team.overloadedMembers || 0) > 0 ? "danger" : "default" },
    { label: "Capacity totale", value: `${summary.team.totalCapacityHours || 0}h` },
    { label: "Ore settimana", value: `${summary.team.loggedHoursThisWeek || 0}h` },
    { label: "Ore mese", value: `${summary.team.loggedHoursThisMonth || 0}h` },
    { label: "Time entry pending", value: summary.team.pendingTimeEntries || 0, tone: (summary.team.pendingTimeEntries || 0) > 0 ? "warning" : "default" },
    { label: "Task scaduti team", value: summary.team.overdueTasksByTeam ?? summary.team.overdueTasks, tone: (summary.team.overdueTasksByTeam ?? summary.team.overdueTasks) > 0 ? "danger" : "default" },
    { label: "Task scaduti", value: summary.team.overdueTasks, tone: summary.team.overdueTasks > 0 ? "danger" : "default" },
    { label: "Task aperti", value: summary.team.openTasks },
    { label: "Task bloccati", value: summary.team.blockedTasks, tone: summary.team.blockedTasks > 0 ? "warning" : "default" },
    { label: "Collaboratori attivi", value: summary.team.activeUsers },
    { label: "Collaboratori bloccati", value: summary.team.blockedCollaborators },
    { label: "Inviti in attesa", value: summary.team.pendingInvites },
  ];

  const customerMetrics: Metric[] = [
    { label: "Clienti attivi", value: summary.customers.activeCustomers },
    { label: "Clienti dormienti", value: summary.customers.dormantCustomers },
    { label: "Ticket aperti", value: summary.customers.openTickets, tone: summary.customers.openTickets > 0 ? "warning" : "default" },
    { label: "Manutenzioni attive", value: summary.customers.activeMaintenance },
    { label: "Upsell possibili", value: summary.customers.upsellOpportunities },
  ];

  const financeMetrics: Metric[] = canSeeFinance && summary.finance ? [
    { label: "Fatture emesse", value: summary.finance.issuedInvoices },
    { label: "Da incassare", value: summary.finance.receivables },
    { label: "Fatture scadute", value: summary.finance.overdueInvoices, tone: summary.finance.overdueInvoices > 0 ? "danger" : "default" },
    { label: "Saldo da richiedere", value: formatCurrency(summary.finance.balanceToRequest) },
    { label: "Incassi mese", value: formatCurrency(summary.finance.paymentsThisMonth || 0), tone: (summary.finance.paymentsThisMonth || 0) > 0 ? "success" : "default" },
    { label: "Totale da incassare", value: formatCurrency(summary.finance.totalOutstanding || 0) },
    { label: "Rinnovi prossimi", value: summary.finance.upcomingRenewals },
    { label: "Scadenze aperte", value: summary.finance.openFinanceDeadlines || 0, tone: (summary.finance.openFinanceDeadlines || 0) > 0 ? "warning" : "default" },
    { label: "Progetti non saldati", value: summary.finance.projectsWithOpenPayments || 0 },
  ] : [];

  const personalMetrics: Metric[] = [
    { label: "I miei task", value: summary.personal.myTasks },
    { label: "Task in scadenza", value: summary.personal.dueSoon, tone: summary.personal.dueSoon > 0 ? "warning" : "default" },
    { label: "Task bloccati", value: summary.personal.blockedTasks, tone: summary.personal.blockedTasks > 0 ? "danger" : "default" },
    { label: "Progetti assegnati", value: summary.personal.assignedProjects },
    { label: "Prossime deadline", value: summary.personal.upcomingDeadlines },
    { label: "Notifiche operative", value: summary.operations.unreadNotifications || summary.operations.notifications.length },
  ];

  const notificationMetrics: Metric[] = [
    {
      label: "Non lette",
      value: summary.operations.unreadNotifications || 0,
      tone: (summary.operations.unreadNotifications || 0) > 0 ? "warning" : "default",
    },
    {
      label: "Urgenti",
      value: summary.operations.urgentNotifications || 0,
      tone: (summary.operations.urgentNotifications || 0) > 0 ? "danger" : "default",
    },
    {
      label: "Task scaduti",
      value: summary.operations.taskOverdueNotifications || 0,
      tone: (summary.operations.taskOverdueNotifications || 0) > 0 ? "danger" : "default",
    },
    ...(canSeeFinance && (summary.operations.financeNotifications || 0) > 0
      ? [{
          label: "Finance",
          value: summary.operations.financeNotifications || 0,
          tone: "warning" as const,
        }]
      : []),
    {
      label: "Digest oggi",
      value: summary.operations.todayDigestAvailable ? "Sì" : "No",
      tone: summary.operations.todayDigestAvailable ? "success" : "default",
    },
  ];

  const documentsSummary = summary.operations.documentsSummary || {
    totalDocuments: 0,
    recentDocuments: [],
    projectDocuments: 0,
    financeDocuments: 0,
    storageUsedBytes: 0,
    sources: {},
  };

  const documentMetrics: Metric[] = [
    { label: "Documenti totali", value: documentsSummary.totalDocuments || 0 },
    { label: "Documenti progetto", value: documentsSummary.projectDocuments || 0 },
    ...(canSeeFinance
      ? [{ label: "Documenti finance", value: documentsSummary.financeDocuments || 0 } satisfies Metric]
      : []),
    { label: "Spazio usato", value: formatDocumentBytes(documentsSummary.storageUsedBytes || 0) },
  ];

  const recentDocuments = documentsSummary.recentDocuments?.length
    ? documentsSummary.recentDocuments
    : summary.operations.recentFiles;

  const documentsCard = (
    <SectionCard
      title="Documenti"
      description="Archivio interno tenant-scoped per allegati, contratti, asset, documenti progetto e finance dove autorizzato."
      icon={FileText}
      metrics={documentMetrics}
      sources={{
        documents:
          (documentsSummary.totalDocuments || 0) > 0 ||
          (documentsSummary.projectDocuments || 0) > 0 ||
          (canSeeFinance && (documentsSummary.financeDocuments || 0) > 0),
      }}
      emptyText="Nessun documento caricato."
    >
      <div className="space-y-3">
        {recentDocuments.length > 0 ? (
          <div className="space-y-2">
            {recentDocuments.slice(0, 3).map((item, index) => {
              const documentItem = item as ActivityItem & {
                original_filename?: string;
                category?: string;
                created_at?: string | null;
              };
              const title = documentItem.title || documentItem.original_filename || "Documento";
              const meta = documentItem.meta || [documentItem.original_filename, documentItem.category].filter(Boolean).join(" · ");
              const createdAt = documentItem.createdAt || documentItem.created_at || null;

              return (
                <div key={`${title}-${index}`} className="flex items-start justify-between gap-3 rounded-nav bg-muted/40 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{title}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{meta || "Documento interno"}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(createdAt)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-nav border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Nessun documento caricato.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/documents">Apri documenti</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/documents/upload">Carica documento</Link>
          </Button>
        </div>
      </div>
    </SectionCard>
  );

  const reportsSummary = summary.operations.reportsSummary || {
    kpiTargetsConfigured: 0,
    reportsAvailable: [],
    executiveRisksCount: 0,
    lastSnapshotAt: null,
    currentMonthRevenue: 0,
    currentMonthNewLeads: 0,
    currentMonthAcceptedQuotes: 0,
    currentMonthOverdueTasks: 0,
    sources: {},
  };

  const reportsAvailableCount = Array.isArray(reportsSummary.reportsAvailable)
    ? reportsSummary.reportsAvailable.length
    : Number(reportsSummary.reportsAvailable || 0);

  const reportMetrics: Metric[] = [
    { label: "Report disponibili", value: reportsAvailableCount },
    { label: "Target KPI", value: reportsSummary.kpiTargetsConfigured || 0 },
    { label: "Rischi direzionali", value: reportsSummary.executiveRisksCount || 0, tone: (reportsSummary.executiveRisksCount || 0) > 0 ? "warning" : "default" },
    { label: "Nuovi lead mese", value: reportsSummary.currentMonthNewLeads || 0 },
    { label: "Preventivi accettati", value: reportsSummary.currentMonthAcceptedQuotes || 0, tone: (reportsSummary.currentMonthAcceptedQuotes || 0) > 0 ? "success" : "default" },
    { label: "Task scaduti mese", value: reportsSummary.currentMonthOverdueTasks || 0, tone: (reportsSummary.currentMonthOverdueTasks || 0) > 0 ? "danger" : "default" },
    ...(canSeeFinance
      ? [{ label: "Revenue mese", value: formatCurrency(reportsSummary.currentMonthRevenue || 0) } satisfies Metric]
      : []),
    { label: "Ultimo snapshot", value: reportsSummary.lastSnapshotAt ? formatDate(reportsSummary.lastSnapshotAt) : "Nessuno" },
  ];

  const reportsCard = (
    <SectionCard
      title="Report/KPI"
      description="Riepilogo direzionale dai report tenant-scoped: obiettivi, rischi e KPI del mese."
      icon={BarChart3}
      metrics={reportMetrics}
      sources={{
        reports:
          reportsAvailableCount > 0 ||
          (reportsSummary.kpiTargetsConfigured || 0) > 0 ||
          (reportsSummary.currentMonthNewLeads || 0) > 0 ||
          (canSeeFinance && (reportsSummary.currentMonthRevenue || 0) > 0),
      }}
      emptyText="Nessun KPI direzionale configurato per il periodo corrente."
    >
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/reports">Apri report</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/reports/executive">Report direzione</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/reports/targets">Obiettivi KPI</Link>
        </Button>
      </div>
    </SectionCard>
  );

  const automationsSummary = summary.operations.automationsSummary || {
    totalRules: 0,
    enabledRules: 0,
    failedRunsToday: 0,
    successfulRunsToday: 0,
    actionsToday: 0,
    lastRunAt: null,
    dueRules: 0,
    automationRisksCount: 0,
    sources: {},
  };

  const automationsCard = (
    <SectionCard
      title="Automazioni"
      description="Regole interne, run manuali/schedulati e controlli dedupe senza integrazioni esterne."
      icon={Workflow}
      metrics={[
        { label: "Regole totali", value: automationsSummary.totalRules || 0 },
        { label: "Regole abilitate", value: automationsSummary.enabledRules || 0, tone: (automationsSummary.enabledRules || 0) > 0 ? "success" : "default" },
        { label: "Run falliti oggi", value: automationsSummary.failedRunsToday || 0, tone: (automationsSummary.failedRunsToday || 0) > 0 ? "danger" : "default" },
        { label: "Run ok oggi", value: automationsSummary.successfulRunsToday || 0 },
        { label: "Azioni oggi", value: automationsSummary.actionsToday || 0 },
        { label: "Regole dovute", value: automationsSummary.dueRules || 0, tone: (automationsSummary.dueRules || 0) > 0 ? "warning" : "default" },
        { label: "Rischi", value: automationsSummary.automationRisksCount || 0, tone: (automationsSummary.automationRisksCount || 0) > 0 ? "danger" : "default" },
        { label: "Ultimo run", value: automationsSummary.lastRunAt ? formatDate(automationsSummary.lastRunAt) : "Nessuno" },
      ]}
      sources={automationsSummary.sources || { automations: (automationsSummary.totalRules || 0) > 0 }}
      emptyText="Nessuna automazione configurata."
    >
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/automations">Apri automazioni</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/automations/rules">Regole</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/automations/runs">Esecuzioni</Link></Button>
      </div>
    </SectionCard>
  );

  const calendarSummary = summary.operations.calendarSummary || {
    eventsToday: 0,
    eventsThisWeek: 0,
    overdueEvents: 0,
    conflictsCount: 0,
    deadlinesThisWeek: 0,
    teamUnavailableToday: 0,
    nextEventAt: null,
    remindersDue: 0,
    derivedEventsCount: 0,
    sources: {},
  };

  const calendarCard = (
    <SectionCard
      title="Calendario"
      description="Agenda interna, scadenze aggregate, conflitti e reminder del team."
      icon={CalendarDays}
      metrics={[
        { label: "Eventi oggi", value: calendarSummary.eventsToday || 0 },
        { label: "Eventi settimana", value: calendarSummary.eventsThisWeek || 0 },
        { label: "Scaduti", value: calendarSummary.overdueEvents || 0, tone: (calendarSummary.overdueEvents || 0) > 0 ? "danger" : "default" },
        { label: "Conflitti", value: calendarSummary.conflictsCount || 0, tone: (calendarSummary.conflictsCount || 0) > 0 ? "warning" : "default" },
        { label: "Scadenze settimana", value: calendarSummary.deadlinesThisWeek || 0 },
        { label: "Team assente oggi", value: calendarSummary.teamUnavailableToday || 0 },
        { label: "Reminder dovuti", value: calendarSummary.remindersDue || 0, tone: (calendarSummary.remindersDue || 0) > 0 ? "warning" : "default" },
        { label: "Derivati", value: calendarSummary.derivedEventsCount || 0 },
        { label: "Prossimo evento", value: calendarSummary.nextEventAt ? formatDate(calendarSummary.nextEventAt) : "Nessuno" },
      ]}
      sources={calendarSummary.sources || { calendar_events: (calendarSummary.eventsThisWeek || 0) > 0 }}
      emptyText="Nessun evento calendario presente."
    >
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/calendar">Apri calendario</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/calendar/agenda">Agenda</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/calendar/deadlines">Scadenze</Link></Button>
      </div>
    </SectionCard>
  );

  const knowledgeSummary = summary.operations.knowledgeSummary || {
    publishedArticles: 0,
    draftArticles: 0,
    articlesDueForReview: 0,
    totalAssets: 0,
    activeTemplates: 0,
    favoritesCount: 0,
    recentlyUpdatedCount: 0,
    systemTemplatesCount: 0,
    knowledgeRisksCount: 0,
    sources: {},
  };

  const knowledgeCard = (
    <SectionCard
      title="Knowledge Base"
      description="Procedure, asset e template operativi interni."
      icon={FileText}
      metrics={[
        { label: "Articoli pubblicati", value: knowledgeSummary.publishedArticles || 0, tone: (knowledgeSummary.publishedArticles || 0) > 0 ? "success" : "default" },
        { label: "Bozze", value: knowledgeSummary.draftArticles || 0 },
        { label: "Da revisionare", value: knowledgeSummary.articlesDueForReview || 0, tone: (knowledgeSummary.articlesDueForReview || 0) > 0 ? "warning" : "default" },
        { label: "Asset", value: knowledgeSummary.totalAssets || 0 },
        { label: "Template attivi", value: knowledgeSummary.activeTemplates || 0 },
        { label: "Preferiti", value: knowledgeSummary.favoritesCount || 0 },
        { label: "Aggiornati di recente", value: knowledgeSummary.recentlyUpdatedCount || 0 },
        { label: "Template sistema", value: knowledgeSummary.systemTemplatesCount || 0 },
        { label: "Rischi", value: knowledgeSummary.knowledgeRisksCount || 0, tone: (knowledgeSummary.knowledgeRisksCount || 0) > 0 ? "danger" : "default" },
      ]}
      sources={knowledgeSummary.sources || { knowledge: (knowledgeSummary.publishedArticles || 0) > 0 }}
      emptyText="Nessun contenuto knowledge presente."
    >
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/knowledge">Apri knowledge</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/knowledge/articles">Articoli</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/knowledge/templates">Template</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/knowledge/assets">Asset</Link></Button>
      </div>
    </SectionCard>
  );

  const credentialsSummary = summary.operations.credentialsSummary || {
    totalCredentials: 0,
    activeCredentials: 0,
    archivedCredentials: 0,
    expiringCredentials: 0,
    renewalsDue: 0,
    rotationDue: 0,
    expiredCredentials: 0,
    sources: {},
  };

  const credentialsCard = (
    <SectionCard
      title="Accessi e credenziali"
      description="Vault interno metadata-only: dashboard solo aggregata, senza titoli o segreti."
      icon={Lock}
      metrics={[
        { label: "Totali", value: credentialsSummary.totalCredentials || 0 },
        { label: "Attive", value: credentialsSummary.activeCredentials || 0, tone: (credentialsSummary.activeCredentials || 0) > 0 ? "success" : "default" },
        { label: "In scadenza", value: credentialsSummary.expiringCredentials || 0, tone: (credentialsSummary.expiringCredentials || 0) > 0 ? "warning" : "default" },
        { label: "Scadute", value: credentialsSummary.expiredCredentials || 0, tone: (credentialsSummary.expiredCredentials || 0) > 0 ? "danger" : "default" },
        { label: "Rinnovi dovuti", value: credentialsSummary.renewalsDue || 0, tone: (credentialsSummary.renewalsDue || 0) > 0 ? "warning" : "default" },
        { label: "Rotazioni dovute", value: credentialsSummary.rotationDue || 0, tone: (credentialsSummary.rotationDue || 0) > 0 ? "warning" : "default" },
      ]}
      sources={credentialsSummary.sources || { credential_items: (credentialsSummary.totalCredentials || 0) > 0 }}
      emptyText="Nessuna credenziale censita nel vault."
    >
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/credentials">Apri vault credenziali</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/credentials/expiring">In scadenza</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/credentials/rotation-due">Rotazioni</Link></Button>
      </div>
    </SectionCard>
  );

  const contractsSummary = summary.operations.contractsSummary || {
    totalContracts: 0,
    draftContracts: 0,
    sentContracts: 0,
    waitingSignatureContracts: 0,
    signedContracts: 0,
    expiringContracts: 0,
    overdueContracts: 0,
    recentContracts: [],
    sources: {},
  };

  const contractsCard = (
    <SectionCard
      title="Contratti"
      description="Contratti, stati firma e scadenze amministrative interne."
      icon={FileCheck2}
      metrics={[
        { label: "Totali", value: contractsSummary.totalContracts || 0 },
        { label: "Bozze", value: contractsSummary.draftContracts || 0 },
        { label: "Inviati", value: contractsSummary.sentContracts || 0 },
        { label: "In attesa firma", value: contractsSummary.waitingSignatureContracts || 0, tone: (contractsSummary.waitingSignatureContracts || 0) > 0 ? "warning" : "default" },
        { label: "Firmati", value: contractsSummary.signedContracts || 0, tone: (contractsSummary.signedContracts || 0) > 0 ? "success" : "default" },
        { label: "In scadenza", value: contractsSummary.expiringContracts || 0, tone: (contractsSummary.expiringContracts || 0) > 0 ? "warning" : "default" },
        { label: "Scaduti", value: contractsSummary.overdueContracts || 0, tone: (contractsSummary.overdueContracts || 0) > 0 ? "danger" : "default" },
      ]}
      sources={contractsSummary.sources || { contracts: (contractsSummary.totalContracts || 0) > 0 }}
      emptyText="Nessun contratto presente."
    >
      <div className="space-y-3">
        {contractsSummary.recentContracts?.length ? (
          <div className="space-y-2">
            {contractsSummary.recentContracts.slice(0, 5).map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex items-start justify-between gap-3 rounded-nav bg-muted/40 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{item.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{item.meta || "Contratto interno"}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/contracts">Apri contratti</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/contracts/new">Nuovo contratto</Link></Button>
        </div>
      </div>
    </SectionCard>
  );

  const paperworkSummary = summary.operations.paperworkSummary || {
    openDossiers: 0,
    blockedDossiers: 0,
    overdueDossiers: 0,
    missingItems: 0,
    dueSoonItems: 0,
    recentDossiers: [],
    sources: {},
  };

  const paperworkCard = (
    <SectionCard
      title="Scartoffie"
      description="Dossier amministrativi, checklist documentali e scadenze operative."
      icon={ClipboardCheck}
      metrics={[
        { label: "Dossier aperti", value: paperworkSummary.openDossiers || 0 },
        { label: "Bloccati", value: paperworkSummary.blockedDossiers || 0, tone: (paperworkSummary.blockedDossiers || 0) > 0 ? "danger" : "default" },
        { label: "Scaduti", value: paperworkSummary.overdueDossiers || 0, tone: (paperworkSummary.overdueDossiers || 0) > 0 ? "danger" : "default" },
        { label: "Item mancanti", value: paperworkSummary.missingItems || 0, tone: (paperworkSummary.missingItems || 0) > 0 ? "warning" : "default" },
        { label: "Item in scadenza", value: paperworkSummary.dueSoonItems || 0, tone: (paperworkSummary.dueSoonItems || 0) > 0 ? "warning" : "default" },
      ]}
      sources={paperworkSummary.sources || { paperwork: (paperworkSummary.openDossiers || 0) > 0 }}
      emptyText="Nessun dossier amministrativo presente."
    >
      <div className="space-y-3">
        {paperworkSummary.recentDossiers?.length ? (
          <div className="space-y-2">
            {paperworkSummary.recentDossiers.slice(0, 5).map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex items-start justify-between gap-3 rounded-nav bg-muted/40 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{item.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{item.meta || "Dossier amministrativo"}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/paperwork">Apri scartoffie</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/paperwork/new">Nuovo dossier</Link></Button>
        </div>
      </div>
    </SectionCard>
  );

  const notificationsCard = (
    <SectionCard
      title="Attenzione richiesta"
      description="Notifiche interne generate da regole reali su progetti, task, preventivi, briefing e finance dove autorizzato."
      icon={Bell}
      metrics={notificationMetrics}
      sources={{
        notifications:
          (summary.operations.unreadNotifications || 0) > 0 ||
          (summary.operations.notifications?.length || 0) > 0 ||
          Boolean(summary.operations.todayDigestAvailable),
      }}
      emptyText="Non ci sono notifiche urgenti."
    >
      <div className="space-y-3">
        {summary.operations.notifications.length > 0 ? (
          <div className="space-y-2">
            {summary.operations.notifications.slice(0, 3).map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex items-start justify-between gap-3 rounded-nav bg-muted/40 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{item.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{item.meta}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-nav border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Non ci sono notifiche urgenti.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/notifications">Apri notifiche</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/notifications/digest">Vedi digest</Link>
          </Button>
        </div>
      </div>
    </SectionCard>
  );

  const headlineKpis = isExecutive
    ? [
        ...(canView("crm") ? [{ label: "Pipeline commerciale", value: formatCurrency(summary.sales.pipelineValue), icon: BarChart3, tone: "info" as const }] : []),
        ...(canSeeFinance && summary.finance ? [{ label: "Da incassare", value: formatCurrency(summary.finance.receivables), icon: Wallet, tone: "success" as const }] : []),
        ...(canView("projects") ? [{ label: "Progetti attivi", value: summary.projects.activeProjects, icon: FolderKanban, tone: "info" as const }] : []),
        ...(canView("team") ? [{ label: "Task aperti team", value: summary.team.openTasks, icon: Users, tone: "default" as const }] : []),
      ]
    : isManager
      ? [
          ...(canView("projects") ? [
            { label: "Progetti assegnati", value: summary.projects.assignedProjects, icon: BriefcaseBusiness, tone: "info" as const },
            { label: "Task in scadenza", value: summary.projects.dueTasks, icon: Clock, tone: summary.projects.dueTasks > 0 ? "warning" as const : "default" as const },
            { label: "Prossime consegne", value: summary.projects.upcomingDeliveries, icon: CalendarDays, tone: "success" as const },
          ] : []),
          ...(canView("notifications") ? [{ label: "Notifiche urgenti", value: summary.operations.urgentNotifications || 0, icon: Bell, tone: "danger" as const }] : []),
        ]
      : [
          ...(canView("projects") ? [
            { label: "I miei task", value: summary.personal.myTasks, icon: CheckCircle2, tone: "info" as const },
            { label: "In scadenza", value: summary.personal.dueSoon, icon: Clock, tone: summary.personal.dueSoon > 0 ? "warning" as const : "default" as const },
            { label: "Progetti assegnati", value: summary.personal.assignedProjects, icon: FolderKanban, tone: "success" as const },
          ] : []),
          ...(canView("notifications") ? [{ label: "Notifiche", value: summary.operations.unreadNotifications || 0, icon: Bell, tone: "default" as const }] : []),
        ];

  return (
    <div className="doflow-page-shell flex-1 space-y-5 p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-bold tracking-normal text-foreground">
              {getGreeting()}, {displayName(summary.user.email)}
            </h1>
            <Badge className="border-0 bg-primary/10 text-primary shadow-none hover:bg-primary/10">{roleLabel}</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {isExecutive
              ? "Una vista aggiornata su vendite, progetti, amministrazione e team."
              : isManager
                ? "Priorità operative, consegne e carico di lavoro del team."
                : "Task personali, prossime scadenze, materiali e notifiche."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadSummary}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aggiorna
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-card border border-chart-5/30 bg-chart-5/10 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-chart-5" />
          <div>
            <p className="font-semibold">Endpoint dashboard non raggiungibile.</p>
            <p className="text-muted-foreground">La vista mostra fallback zero/empty state. Dettaglio: {error}</p>
          </div>
        </div>
      ) : null}

      {headlineKpis.length > 0 ? (
        <KpiGrid>
          {headlineKpis.slice(0, 4).map((kpi) => <KpiStatCard key={kpi.label} {...kpi} />)}
        </KpiGrid>
      ) : null}

      <section className="space-y-3">
        <WorkspaceSectionHeader
          title="Priorità di oggi"
          description="Le attività che richiedono attenzione immediata."
        />
        <PriorityStrip
          items={[
            ...(canView("notifications")
              ? [{
                  label: "Attenzione",
                  value: (summary.operations.urgentNotifications || 0) + (summary.operations.unreadNotifications || 0),
                  href: "/notifications",
                  icon: Bell,
                  tone: (summary.operations.urgentNotifications || 0) > 0 ? "danger" as const : "warning" as const,
                }]
              : []),
            ...(canView("projects")
              ? [{
                  label: "Progetti critici",
                  value: (summary.projects.lateProjects || 0) + (summary.projects.blockedProjects || 0),
                  href: "/projects",
                  icon: FolderKanban,
                  tone: (summary.projects.lateProjects || 0) + (summary.projects.blockedProjects || 0) > 0 ? "danger" as const : "success" as const,
                }]
              : []),
            ...(canView("calendar")
              ? [{
                  label: "Scadenze",
                  value: (summary.projects.dueTasks || 0) + (summary.projects.upcomingMilestones || 0),
                  href: "/calendar/deadlines",
                  icon: CalendarDays,
                  tone: (summary.projects.dueTasks || 0) > 0 ? "warning" as const : "success" as const,
                }]
              : []),
          ]}
        />
      </section>

      {isExecutive ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {canView("crm") ? (
              <SectionCard
                title="Vendite"
                description="Lead, opportunità, preventivi e follow-up della web agency."
                icon={BarChart3}
                metrics={salesMetrics}
                sources={summary.sales.sources}
                emptyText="Non ci sono ancora attività commerciali da mostrare."
              />
            ) : null}
            {canView("briefing") ? (
              <SectionCard
                title="Briefing e materiali"
                description="Briefing cliente, review interna e materiali ancora da raccogliere."
                icon={FileCheck2}
                metrics={briefingMetrics}
                sources={summary.operations.sources}
                emptyText="Nessun briefing o materiale richiede attenzione."
              />
            ) : null}
            {canView("projects") ? (
              <SectionCard
                title="Progetti"
                description="Avanzamento delivery, blocchi e consegne in arrivo."
                icon={FolderKanban}
                metrics={projectMetrics}
                sources={summary.projects.sources}
                emptyText="Non ci sono progetti o consegne da mostrare."
              />
            ) : null}
            {canSeeFinance && summary.finance ? (
              <SectionCard
                title="Finance"
                description="Fatture, incassi, rinnovi e margine per i ruoli autorizzati."
                icon={Wallet}
                metrics={financeMetrics}
                sources={summary.finance.sources}
                emptyText="Non ci sono movimenti amministrativi da mostrare."
              />
            ) : null}
            {canView("team") ? (
              <SectionCard
                title="Team"
                description="Carico operativo, inviti e task del team."
                icon={Users}
                metrics={teamMetrics}
                sources={summary.team.sources}
                emptyText="Nessun carico o invito del team richiede attenzione."
              >
                {summary.team.workload.length > 0 ? (
                  <div className="space-y-2">
                    {summary.team.workload.map((item) => (
                      <div key={item.assignee} className="flex items-center justify-between rounded-nav bg-muted/40 px-3 py-2 text-sm">
                        <span className="truncate font-medium">{item.assignee}</span>
                        <span className="tabular-nums text-muted-foreground">{item.openTasks} task · {item.utilizationPercent || 0}%</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm"><Link href="/team">Apri Team</Link></Button>
                  <Button asChild variant="outline" size="sm"><Link href="/team/workload">Carichi lavoro</Link></Button>
                  <Button asChild variant="outline" size="sm"><Link href="/team/time-entries">Ore lavorate</Link></Button>
                </div>
              </SectionCard>
            ) : null}
            {canView("notifications") ? notificationsCard : null}
            {canView("documents") ? documentsCard : null}
            {canView("reports") ? reportsCard : null}
            {canView("automations") ? automationsCard : null}
            {canView("calendar") ? calendarCard : null}
            {canView("knowledge") ? knowledgeCard : null}
            {canView("credentials") ? credentialsCard : null}
            {canView("contracts") ? contractsCard : null}
            {canView("paperwork") ? paperworkCard : null}
          </div>
          {canView("crm") ? (
            <SectionCard
              title="Clienti"
              description="Clienti, ticket, manutenzioni e segnali upsell."
              icon={Handshake}
              metrics={customerMetrics}
              sources={summary.customers.sources}
              emptyText="Non ci sono aggiornamenti recenti sui clienti."
            />
          ) : null}
          <QuickActions actions={executiveActions} />
        </>
      ) : null}

      {isManager ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {canView("projects") ? (
              <SectionCard
                title="Progetti assegnati"
                description="Delivery, milestone, task bloccati e prossime consegne."
                icon={BriefcaseBusiness}
                metrics={[
                  { label: "Progetti assegnati", value: summary.projects.assignedProjects },
                  { label: "Milestone in scadenza", value: summary.projects.upcomingMilestones },
                  { label: "Task bloccati", value: summary.projects.blockedTasks, tone: summary.projects.blockedTasks > 0 ? "warning" : "default" },
                  ...(canView("team") ? [{ label: "Task del team", value: summary.team.openTasks } satisfies Metric] : []),
                  ...(canView("briefing") ? [
                    { label: "Materiali mancanti", value: summary.operations.missingMaterials } satisfies Metric,
                    { label: "Briefing incompleti", value: summary.operations.incompleteBriefings || 0 } satisfies Metric,
                  ] : []),
                ]}
                sources={{ ...summary.projects.sources, ...(canView("team") ? summary.team.sources : {}), ...summary.operations.sources }}
                emptyText="Non ci sono progetti o attività assegnate da mostrare."
              />
            ) : null}
            {canView("calendar") ? (
              <SectionCard
                title="Calendario consegne"
                description="Scadenze operative senza valore economico o margini."
                icon={CalendarDays}
                metrics={[
                  { label: "Consegne prossime", value: summary.projects.upcomingDeliveries },
                  { label: "Task in scadenza", value: summary.projects.dueTasks },
                  { label: "Progetti in ritardo", value: summary.projects.lateProjects, tone: summary.projects.lateProjects > 0 ? "danger" : "default" },
                ]}
                sources={summary.projects.sources}
                emptyText="Nessuna consegna o milestone in calendario."
              />
            ) : null}
            {canView("notifications") ? notificationsCard : null}
            {canView("documents") ? documentsCard : null}
            {canView("reports") ? reportsCard : null}
            {canView("automations") ? automationsCard : null}
            {canView("calendar") ? calendarCard : null}
            {canView("knowledge") ? knowledgeCard : null}
            {canView("credentials") ? credentialsCard : null}
            {canView("contracts") ? contractsCard : null}
            {canView("paperwork") ? paperworkCard : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {canView("projects") ? <ActivityList title="Commenti recenti" items={summary.operations.recentComments} empty="Nessun commento recente." icon={MessageSquare} /> : null}
            {canView("documents") ? <ActivityList title="File recenti" items={summary.operations.recentFiles} empty="Nessun file recente nel tenant." icon={FileText} /> : null}
            {canView("notifications") ? <ActivityList title="Notifiche operative" items={summary.operations.notifications} empty="Nessuna notifica operativa recente." icon={Clock} /> : null}
          </div>
          <QuickActions actions={managerActions} />
        </>
      ) : null}

      {!isExecutive && !isManager ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {canView("projects") ? (
              <SectionCard
                title="Il mio lavoro"
                description="Task, blocchi, progetti assegnati e prossime deadline."
                icon={CheckCircle2}
                metrics={personalMetrics}
                sources={summary.personal.sources}
                emptyText="Non hai task o scadenze personali da mostrare."
              />
            ) : null}
            <SectionCard
              title="Operatività"
              description="Materiali, commenti e notifiche utili per lavorare senza rumore direzionale."
              icon={FolderKanban}
              metrics={[
                ...(canView("documents") ? [{ label: "File/materiali necessari", value: summary.operations.recentFiles.length } satisfies Metric] : []),
                ...(canView("projects") ? [{ label: "Commenti recenti", value: summary.operations.recentComments.length } satisfies Metric] : []),
                ...(canView("notifications") ? [{ label: "Notifiche operative", value: summary.operations.notifications.length } satisfies Metric] : []),
                ...(canView("calendar") ? [{ label: "Prossime consegne", value: summary.operations.upcomingDeliveries } satisfies Metric] : []),
              ]}
              sources={{ files: canView("documents") && summary.operations.recentFiles.length > 0, comments: canView("projects") && summary.operations.recentComments.length > 0 }}
              emptyText="Nessun aggiornamento operativo recente."
            />
            {canView("notifications") ? notificationsCard : null}
            {canView("documents") ? documentsCard : null}
            {canView("reports") ? reportsCard : null}
            {canView("automations") ? automationsCard : null}
            {canView("calendar") ? calendarCard : null}
            {canView("knowledge") ? knowledgeCard : null}
            {canView("credentials") ? credentialsCard : null}
            {canView("contracts") ? contractsCard : null}
            {canView("paperwork") ? paperworkCard : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {canView("projects") ? <ActivityList title="Commenti recenti" items={summary.operations.recentComments} empty="Nessun commento recente." icon={MessageSquare} /> : null}
            {canView("documents") ? <ActivityList title="File e materiali" items={summary.operations.recentFiles} empty="Nessun file o materiale richiesto." icon={FileText} /> : null}
            {canView("notifications") ? <ActivityList title="Notifiche" items={summary.operations.notifications} empty="Nessuna notifica operativa." icon={Clock} /> : null}
          </div>
          <QuickActions actions={employeeActions} />
        </>
      ) : null}
    </div>
  );
}
