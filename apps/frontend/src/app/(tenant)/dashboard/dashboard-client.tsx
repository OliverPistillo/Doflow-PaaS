"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, FolderKanban, ListChecks, Wallet } from "lucide-react";

import { calendarApi, type CalendarEvent } from "@/lib/tenant-calendar-api";
import { apiFetch } from "@/lib/api";
import { getDoFlowUser } from "@/lib/jwt";
import { reportsApi } from "@/lib/tenant-reports-api";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { DashboardDeadlines } from "./dashboard-deadlines";
import { dashboardCurrency, dashboardDisplayName, dashboardGreeting } from "./dashboard-format";
import { DashboardKpiCard } from "./dashboard-kpi-card";
import { DashboardLineChart } from "./dashboard-line-chart";
import { DashboardPipeline } from "./dashboard-pipeline";
import { DashboardPriorities } from "./dashboard-priorities";
import { DashboardProjects } from "./dashboard-projects";
import { DashboardStatusDonut } from "./dashboard-status-donut";
import type {
  DashboardProject,
  DashboardSummary,
  DashboardTask,
  ListResponse,
  ReportSnapshot,
  RevenuePoint,
} from "./dashboard-types";

function snapshotRevenue(payload?: Record<string, unknown> | null): number | null {
  if (!payload) return null;
  const direct = payload.currentMonthRevenue ?? payload.monthly_revenue;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const finance = payload.finance;
  if (typeof finance === "object" && finance !== null) {
    const value = (finance as Record<string, unknown>).paymentsInPeriod;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function revenuePoints(snapshots: ReportSnapshot[], currentRevenue?: number): RevenuePoint[] {
  const points = snapshots
    .map((snapshot) => {
      const value = snapshotRevenue(snapshot.payload);
      const date = snapshot.created_at ? new Date(snapshot.created_at) : null;
      if (value === null || !date || Number.isNaN(date.getTime())) return null;
      return {
        timestamp: date.getTime(),
        label: new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date),
        value,
      };
    })
    .filter((item): item is RevenuePoint & { timestamp: number } => Boolean(item))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-6)
    .map(({ label, value }) => ({ label, value }));

  if (typeof currentRevenue === "number" && Number.isFinite(currentRevenue)) {
    const currentLabel = new Intl.DateTimeFormat("it-IT", { month: "short" }).format(new Date());
    const last = points.at(-1);
    if (!last || last.label !== currentLabel) points.push({ label: currentLabel, value: currentRevenue });
  }
  return points.slice(-6);
}

export default function DashboardClient() {
  const { loading: accessLoading, canView } = useTenantAccess();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [deadlines, setDeadlines] = useState<CalendarEvent[]>([]);
  const [snapshots, setSnapshots] = useState<ReportSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [summaryResult, projectsResult, tasksResult, deadlinesResult, snapshotsResult] = await Promise.allSettled([
        apiFetch<DashboardSummary>("/tenant/dashboard/summary"),
        canView("projects")
          ? apiFetch<ListResponse<DashboardProject>>("/tenant/projects?limit=4")
          : Promise.resolve({ items: [] }),
        canView("projects")
          ? apiFetch<ListResponse<DashboardTask>>("/tenant/projects/tasks?limit=8")
          : Promise.resolve({ items: [] }),
        canView("calendar")
          ? calendarApi.getCalendarDeadlines({ limit: 4 })
          : Promise.resolve({ items: [] }),
        canView("reports") && canView("finance")
          ? reportsApi.snapshots({ report_key: "executive", limit: 6 })
          : Promise.resolve({ items: [] }),
      ]);

      if (summaryResult.status === "rejected") throw summaryResult.reason;
      setSummary(summaryResult.value);
      setProjects(projectsResult.status === "fulfilled" ? projectsResult.value.items || [] : []);
      setTasks(tasksResult.status === "fulfilled" ? tasksResult.value.items || [] : []);
      setDeadlines(deadlinesResult.status === "fulfilled" ? deadlinesResult.value.items || [] : []);
      setSnapshots(snapshotsResult.status === "fulfilled" ? snapshotsResult.value.items || [] : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Dashboard non disponibile");
      setSummary(null);
      setProjects([]);
      setTasks([]);
      setDeadlines([]);
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    if (!accessLoading) void loadDashboard();
  }, [accessLoading, loadDashboard]);

  const jwtUser = getDoFlowUser();
  const email = summary?.user?.email || jwtUser?.email;
  const isExecutive = ["owner", "admin", "superadmin", "super_admin"].includes(
    String(summary?.user?.role || jwtUser?.role || "").toLowerCase(),
  );
  const currentRevenue = summary?.operations?.reportsSummary?.currentMonthRevenue
    ?? summary?.finance?.paymentsThisMonth;
  const chartData = useMemo(
    () => revenuePoints(snapshots, currentRevenue),
    [currentRevenue, snapshots],
  );

  const kpis = [
    ...(canView("finance") && isExecutive
      ? [
          {
            label: "Da incassare",
            value: dashboardCurrency(summary?.finance?.receivables || summary?.finance?.totalOutstanding || 0),
            icon: Wallet,
            tone: "green" as const,
          },
        ]
      : []),
    ...(canView("crm")
      ? [{
          label: "Pipeline commerciale",
          value: dashboardCurrency(summary?.sales?.pipelineValue || 0),
          icon: BriefcaseBusiness,
          tone: "violet" as const,
        }]
      : []),
    ...(canView("projects")
      ? [{
          label: "Progetti attivi",
          value: summary?.projects?.activeProjects || summary?.personal?.assignedProjects || 0,
          icon: FolderKanban,
          tone: "blue" as const,
        }]
      : []),
    ...(canView("projects")
      ? [{
          label: "Task aperti",
          value: summary?.personal?.myTasks || summary?.team?.openTasks || 0,
          icon: ListChecks,
          tone: "green" as const,
        }]
      : []),
  ].slice(0, 4);

  const statusData = [
    { label: "In corso", value: Math.max(0, Number(summary?.team?.openTasks || summary?.personal?.myTasks || 0)), color: "#6558e8" },
    { label: "In attesa", value: Math.max(0, Number(summary?.projects?.dueTasks || summary?.personal?.dueSoon || 0)), color: "#ff9827" },
    { label: "Bloccate", value: Math.max(0, Number(summary?.team?.blockedTasks || summary?.personal?.blockedTasks || 0)), color: "#ef4f5b" },
  ];

  if (loading || accessLoading) {
    return (
      <div className="doflow-dashboard-page">
        <div className="h-14 w-80 animate-pulse rounded-xl bg-slate-100" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-[132px] animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
        <div className="h-[320px] animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  return (
    <main className="doflow-dashboard-page">
      <header>
        <h1 className="text-[30px] font-bold leading-tight tracking-normal text-slate-950">
          {dashboardGreeting()}, {dashboardDisplayName(email)}
        </h1>
        <p className="mt-1 text-[15px] text-slate-500">
          {isExecutive ? "Ecco cosa richiede la tua attenzione oggi." : "Ecco le tue attività e scadenze di oggi."}
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Non è stato possibile aggiornare la dashboard. {error}
        </div>
      ) : null}

      {kpis.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => <DashboardKpiCard key={kpi.label} {...kpi} />)}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <DashboardLineChart data={chartData} />
        </div>
        <div className="xl:col-span-3">
          <DashboardStatusDonut data={statusData} />
        </div>
        <div className="xl:col-span-4">
          <DashboardDeadlines items={deadlines} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <DashboardPriorities
            tasks={tasks}
            notifications={summary?.operations?.notifications || []}
          />
        </div>
        <div className="xl:col-span-5">
          <DashboardProjects projects={projects} />
        </div>
        {canView("crm") ? (
          <div className="xl:col-span-2">
            <DashboardPipeline
              leads={summary?.sales?.openLeads || 0}
              quotes={summary?.sales?.sentQuotes || 0}
              won={summary?.sales?.wonDeals || summary?.sales?.acceptedQuotes || 0}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
