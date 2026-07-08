"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  GrayCard,
} from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { getDoFlowUser } from "@/lib/jwt";
import { getTenantRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";

type DashboardAudience = "executive" | "manager" | "employee";

type SourceFlags = Record<string, boolean>;

type ActivityItem = {
  title: string;
  meta: string;
  createdAt: string | null;
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
    workload: Array<{ assignee: string; openTasks: number }>;
    blockedCollaborators: number;
    pendingInvites: number;
    activeUsers: number;
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
    openClientReviews: number;
    upcomingDeliveries: number;
    recentComments: ActivityItem[];
    recentFiles: ActivityItem[];
    notifications: ActivityItem[];
    sources?: SourceFlags;
  };
};

type Metric = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
};

type QuickAction = {
  label: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  note?: string;
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
      openClientReviews: 0,
      upcomingDeliveries: 0,
      recentComments: [],
      recentFiles: [],
      notifications: [],
      sources: {},
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

function hasSource(sources: SourceFlags): boolean {
  return Object.values(sources || {}).some(Boolean);
}

function metricsAreZero(metrics: Metric[]): boolean {
  return metrics.every((metric) => {
    if (typeof metric.value === "number") return metric.value === 0;
    return metric.value === "0" || metric.value === formatCurrency(0);
  });
}

function SectionCard({
  title,
  description,
  icon: Icon,
  metrics,
  sources,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  metrics: Metric[];
  sources?: SourceFlags;
  emptyText: string;
  children?: ReactNode;
}) {
  const isFallback = !hasSource(sources || {}) && metricsAreZero(metrics);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-nav bg-primary/10 p-2 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <CardTitle className="text-[18px]">{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </div>
        {isFallback ? (
          <Badge variant="outline" className="shrink-0 border-border text-muted-foreground">
            In attesa dati
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {metrics.map((metric) => (
            <GrayCard key={metric.label} className="p-4">
              <p className="text-xs font-semibold text-muted-foreground">{metric.label}</p>
              <p
                className={cn(
                  "mt-1 text-2xl font-bold tabular-nums text-foreground",
                  metric.tone === "danger" && "text-destructive",
                  metric.tone === "warning" && "text-chart-5",
                  metric.tone === "success" && "text-chart-2",
                )}
              >
                {metric.value}
              </p>
              {metric.hint ? (
                <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
              ) : null}
            </GrayCard>
          ))}
        </div>
        {children}
        {isFallback ? (
          <div className="rounded-nav border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActivityList({
  title,
  items,
  empty,
  icon: Icon,
}: {
  title: string;
  items: ActivityItem[];
  empty: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <span className="rounded-nav bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <CardTitle className="text-[18px]">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-nav border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {empty}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.meta}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-[18px]">Azioni rapide</CardTitle>
        <CardDescription>Comandi operativi per il lavoro interno doflow.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;
            const content = (
              <Button
                variant={action.disabled ? "outline" : "default"}
                className="h-auto w-full justify-between gap-3 px-4 py-3"
                disabled={action.disabled}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{action.label}</span>
                </span>
                {action.disabled ? (
                  <Badge variant="outline" className="shrink-0">In arrivo</Badge>
                ) : (
                  <ArrowRight className="h-4 w-4 shrink-0" />
                )}
              </Button>
            );

            return action.href && !action.disabled ? (
              <Link key={action.label} href={action.href}>
                {content}
              </Link>
            ) : (
              <div key={action.label} title={action.note}>
                {content}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function FinanceLockedNotice() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-start gap-3 p-5">
        <span className="rounded-nav bg-muted p-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
        </span>
        <div>
          <p className="font-semibold text-foreground">Finance non disponibile per questo ruolo</p>
          <p className="text-sm text-muted-foreground">
            Fatture, margini, pipeline economica e costi interni restano visibili solo a CEO/owner e admin.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardClient() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DashboardSummary>("/tenant/dashboard/summary");
      setSummary(data);
    } catch (err) {
      setSummary(getFallbackSummary());
      setError(err instanceof Error ? err.message : "Dashboard non disponibile");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const audience = summary?.user.dashboardAudience || "employee";
  const roleLabel = getTenantRoleLabel(summary?.user.role);
  const isExecutive = audience === "executive";
  const isManager = audience === "manager";

  const executiveActions = useMemo<QuickAction[]>(() => [
    { label: "Nuovo lead", href: "/leads", icon: Handshake },
    { label: "Nuovo briefing", href: "/briefings/new", icon: FileText },
    { label: "Nuovo preventivo", href: "/quotes/new", icon: Send },
    { label: "Nuovo progetto", href: "/projects/new", icon: FolderKanban },
    { label: "Invita dipendente", href: "/team", icon: UserPlus },
    { label: "Apri finance", href: "/finance", icon: Wallet },
  ], []);

  const managerActions = useMemo<QuickAction[]>(() => [
    { label: "Apri task", href: "/projects/tasks", icon: CheckCircle2 },
    { label: "Calendario consegne", href: "/projects/timeline", icon: CalendarDays },
    { label: "File e materiali", href: "/projects/files", icon: FileText },
  ], []);

  const employeeActions = useMemo<QuickAction[]>(() => [
    { label: "I miei task", href: "/projects/tasks", icon: CheckCircle2 },
    { label: "File necessari", href: "/projects/files", icon: FileText },
    { label: "Notifiche", href: "/notifications", icon: MessageSquare },
  ], []);

  if (isLoading || !summary) {
    return (
      <div className="flex h-full items-center justify-center" role="status" aria-label="Caricamento dashboard">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const salesMetrics: Metric[] = [
    { label: "Lead aperti", value: summary.sales.openLeads },
    { label: "Opportunità attive", value: summary.sales.activeOpportunities },
    { label: "Valore pipeline", value: formatCurrency(summary.sales.pipelineValue), hint: "Visibile solo a CEO/Admin" },
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

  const financeMetrics: Metric[] = summary.finance ? [
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
    { label: "Notifiche operative", value: summary.operations.notifications.length },
  ];

  return (
    <div className="flex-1 space-y-5 p-4 pt-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] font-bold tracking-tight text-foreground">
              {getGreeting()}, {displayName(summary.user.email)}
            </h1>
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">{roleLabel}</Badge>
            <Badge variant="outline">{summary.tenant.slug || summary.tenant.schema}</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {isExecutive
              ? "Vista direzionale doflow: vendite, progetti, finance, team e clienti senza dati dimostrativi."
              : isManager
                ? "Vista project manager: priorità operative, consegne e materiali senza informazioni finanziarie."
                : "Vista operativa: task personali, scadenze, materiali e notifiche senza dati economici."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error ? (
            <Badge variant="outline" className="border-chart-5/40 text-chart-5">
              Fallback locale
            </Badge>
          ) : null}
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

      {isExecutive ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Vendite"
              description="Lead, opportunità, preventivi e follow-up della web agency."
              icon={BarChart3}
              metrics={salesMetrics}
              sources={summary.sales.sources}
              emptyText="Le tabelle CRM V2 commerciali non hanno ancora dati: zeri reali, nessun mock."
            />
            <SectionCard
              title="Briefing e materiali"
              description="Briefing cliente, review interna e materiali ancora da raccogliere."
              icon={FileCheck2}
              metrics={briefingMetrics}
              sources={summary.operations.sources}
              emptyText="Briefing e materiali sono collegati a tabelle reali; compariranno appena creati."
            />
            <SectionCard
              title="Progetti"
              description="Avanzamento delivery, blocchi e consegne in arrivo."
              icon={FolderKanban}
              metrics={projectMetrics}
              sources={summary.projects.sources}
              emptyText="Progetti, task e milestone sono collegati a Projects V2: compariranno appena creati."
            />
            {summary.finance ? (
              <SectionCard
                title="Finance"
                description="Fatture, incassi, rinnovi e margine. Sezione riservata a CEO/Admin."
                icon={Wallet}
                metrics={financeMetrics}
                sources={summary.finance.sources}
                emptyText="Le tabelle finance tenant non sono ancora disponibili: nessun dato economico viene simulato."
              />
            ) : null}
            <SectionCard
              title="Team"
              description="Carico operativo, inviti e task del team."
              icon={Users}
              metrics={teamMetrics}
              sources={summary.team.sources}
              emptyText="Utenti e inviti sono reali; task e workload arrivano da Projects V2 quando presenti."
            >
              {summary.team.workload.length > 0 ? (
                <div className="space-y-2">
                  {summary.team.workload.map((item) => (
                    <div key={item.assignee} className="flex items-center justify-between rounded-nav bg-muted/40 px-3 py-2 text-sm">
                      <span className="truncate font-medium">{item.assignee}</span>
                      <span className="tabular-nums text-muted-foreground">{item.openTasks} task aperti</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </SectionCard>
          </div>
          <SectionCard
            title="Clienti"
            description="Clienti, ticket, manutenzioni e segnali upsell."
            icon={Handshake}
            metrics={customerMetrics}
            sources={summary.customers.sources}
            emptyText="Ticket support è letto se disponibile; clienti, manutenzioni e upsell attendono tabelle CRM V2 reali."
          />
          <QuickActions actions={executiveActions} />
        </>
      ) : null}

      {isManager ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Progetti assegnati"
              description="Delivery, milestone, task bloccati e prossime consegne."
              icon={BriefcaseBusiness}
              metrics={[
                { label: "Progetti assegnati", value: summary.projects.assignedProjects },
                { label: "Milestone in scadenza", value: summary.projects.upcomingMilestones },
                { label: "Task bloccati", value: summary.projects.blockedTasks, tone: summary.projects.blockedTasks > 0 ? "warning" : "default" },
                { label: "Task del team", value: summary.team.openTasks },
                { label: "Materiali mancanti", value: summary.operations.missingMaterials },
                { label: "Briefing incompleti", value: summary.operations.incompleteBriefings || 0 },
                { label: "Review cliente aperte", value: summary.operations.openClientReviews },
              ]}
              sources={{ ...summary.projects.sources, ...summary.team.sources, ...summary.operations.sources }}
              emptyText="La vista PM non usa mock: progetti, task, materiali e review restano a zero finché non sono persistenti."
            />
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
              emptyText="Calendario e milestone saranno popolati da tabelle progetto/task reali."
            />
          </div>
          <FinanceLockedNotice />
          <div className="grid gap-4 lg:grid-cols-3">
            <ActivityList title="Commenti recenti" items={summary.operations.recentComments} empty="Nessun commento recente collegato a tabelle persistenti." icon={MessageSquare} />
            <ActivityList title="File recenti" items={summary.operations.recentFiles} empty="Nessun file recente nel tenant." icon={FileText} />
            <ActivityList title="Notifiche operative" items={summary.operations.notifications} empty="Nessuna notifica operativa recente." icon={Clock} />
          </div>
          <QuickActions actions={managerActions} />
        </>
      ) : null}

      {!isExecutive && !isManager ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Il mio lavoro"
              description="Task, blocchi, progetti assegnati e prossime deadline."
              icon={CheckCircle2}
              metrics={personalMetrics}
              sources={summary.personal.sources}
              emptyText="Nessun task personale persistente disponibile: zeri reali, nessuna pipeline o finance esposta."
            />
            <SectionCard
              title="Operatività"
              description="Materiali, commenti e notifiche utili per lavorare senza rumore direzionale."
              icon={FolderKanban}
              metrics={[
                { label: "File/materiali necessari", value: summary.operations.recentFiles.length },
                { label: "Commenti recenti", value: summary.operations.recentComments.length },
                { label: "Notifiche operative", value: summary.operations.notifications.length },
                { label: "Prossime consegne", value: summary.operations.upcomingDeliveries },
              ]}
              sources={{ files: summary.operations.recentFiles.length > 0, comments: summary.operations.recentComments.length > 0 }}
              emptyText="File, commenti e notifiche compaiono solo se esistono dati reali per il tenant."
            />
          </div>
          <FinanceLockedNotice />
          <div className="grid gap-4 lg:grid-cols-3">
            <ActivityList title="Commenti recenti" items={summary.operations.recentComments} empty="Nessun commento recente." icon={MessageSquare} />
            <ActivityList title="File e materiali" items={summary.operations.recentFiles} empty="Nessun file o materiale richiesto." icon={FileText} />
            <ActivityList title="Notifiche" items={summary.operations.notifications} empty="Nessuna notifica operativa." icon={Clock} />
          </div>
          <QuickActions actions={employeeActions} />
        </>
      ) : null}
    </div>
  );
}
