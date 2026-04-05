// apps/frontend/src/app/superadmin/page.tsx
// Control Room: la nuova homepage del superadmin.
// Aggrega KPI da Finance (MRR, ARR), Platform (tenant attivi, churn),
// System (health status), CRM (tickets aperti, preventivi in attesa).

"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Building2, CircleDollarSign, Activity, LifeBuoy,
  FileText, RefreshCw, Loader2,
  CheckCircle2, XCircle, AlertTriangle, ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ControlRoomData {
  // Tier 1 — Business Health
  mrr: number;
  arr: number;
  activeTenants: number;
  totalTenants: number;
  churnRate: number;
  winRate: number;

  // Tier 2 — Operational Pulse
  systemStatus: "up" | "degraded" | "down";
  openTickets: number;
  pendingQuotes: number;
  expiringTrials: number;

  // Tier 3 — Charts
  revenueTrend: { month: string; amount: number }[];
  pipelineDistribution: { stage: string; count: number; value: number }[];

  // Tier 4 — Activity feed
  recentActivity: {
    id: string;
    type: "tenant" | "payment" | "ticket" | "deal" | "system";
    title: string;
    subtitle: string;
    timestamp: string;
  }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Entrambe le funzioni usano Number() esplicito per sopravvivere a valori
// undefined, null o stringhe che arrivano dall'API prima che il backend
// sia completamente aggiornato.
const fmtEur = (n: unknown) => {
  const num = Number(n) || 0;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
    notation: num >= 100_000 ? "compact" : "standard",
  }).format(num);
};

const fmtPct = (n: unknown) => `${(Number(n) || 0).toFixed(1)}%`;

type Trend = { value: number; label?: string };

function TrendChip({ trend }: { trend?: Trend }) {
  if (!trend) return null;
  const positive = trend.value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
        positive ? "text-emerald-500" : "text-red-500"
      }`}
    >
      {positive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ""}
    </span>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  trend,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  trend?: Trend;
  href?: string;
}) {
  const inner = (
    <Card className="glass-card border-none overflow-hidden relative group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer">
      {/* Glow blob */}
      <div
        className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-15 blur-2xl group-hover:opacity-30 transition-opacity duration-500 pointer-events-none"
        style={{ backgroundColor: accent }}
      />
      <CardContent className="pt-5 pb-5 relative z-10 flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {label}
          </p>
          <p className="text-3xl font-black text-foreground mt-2 tabular-nums tracking-tight">
            {value}
          </p>
          {sub && (
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          )}
          {trend && (
            <div className="mt-2">
              <TrendChip trend={trend} />
            </div>
          )}
        </div>
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm"
          style={{
            backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
            color: accent,
            border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href} className="block">{inner}</Link>;
  }
  return inner;
}

// ─── SystemHealthCard ─────────────────────────────────────────────────────────

function SystemHealthCard({ status }: { status: "up" | "degraded" | "down" | undefined }) {
  const config = {
    up:      { color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", dot: "bg-emerald-500 animate-pulse", label: "Tutti i sistemi operativi",    Icon: CheckCircle2 },
    degraded:{ color: "text-amber-500",   bg: "bg-amber-50 dark:bg-amber-900/20",    dot: "bg-amber-500 animate-pulse",   label: "Sistemi parzialmente degradati", Icon: AlertTriangle },
    down:    { color: "text-red-500",     bg: "bg-red-50 dark:bg-red-900/20",        dot: "bg-red-500 animate-pulse",     label: "Guasto critico rilevato",       Icon: XCircle       },
  } as const;

  const key = status ?? "degraded";
  const { color, bg, dot, label, Icon } = config[key];

  return (
    <Link href="/superadmin/system">
      <Card className={`border-none overflow-hidden relative group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer ${bg}`}>
        <CardContent className="pt-5 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-background/60 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">System Health</p>
              <p className={`text-sm font-bold mt-0.5 ${color}`}>{label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── ActivityFeed ─────────────────────────────────────────────────────────────

const ACTIVITY_ICONS = {
  tenant:  { icon: Building2,        color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-900/20"    },
  payment: { icon: CircleDollarSign, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  ticket:  { icon: LifeBuoy,         color: "text-amber-500",   bg: "bg-amber-50 dark:bg-amber-900/20"  },
  deal:    { icon: TrendingUp,       color: "text-violet-500",  bg: "bg-violet-50 dark:bg-violet-900/20" },
  system:  { icon: Activity,         color: "text-red-500",     bg: "bg-red-50 dark:bg-red-900/20"      },
} as const;

function ActivityFeed({ items }: { items: ControlRoomData["recentActivity"] }) {
  if (!items?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Nessuna attività recente
      </div>
    );
  }

  return (
    <div className="space-y-0 divide-y divide-border">
      {items.map((item) => {
        const { icon: Icon, color, bg } = ACTIVITY_ICONS[item.type] ?? ACTIVITY_ICONS.system;
        const relTime = (() => {
          const diff = Date.now() - new Date(item.timestamp).getTime();
          const m = Math.floor(diff / 60000);
          if (m < 1)  return "adesso";
          if (m < 60) return `${m}m fa`;
          const h = Math.floor(m / 60);
          if (h < 24) return `${h}h fa`;
          return `${Math.floor(h / 24)}g fa`;
        })();

        return (
          <div key={item.id} className="flex items-center gap-3 py-3 group">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${bg} ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
              {relTime}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── ControlRoomPage ──────────────────────────────────────────────────────────

export default function ControlRoomPage() {
  const [data, setData]       = useState<ControlRoomData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch parallelo: metrics + subscriptions + tickets + system status + activity
      const [metrics, subs, tickets, system, activity] = await Promise.allSettled([
        apiFetch<{ mrr: number; arr: number; activeTenants: number; totalTenants: number; churnRate: number }>("/superadmin/metrics"),
        apiFetch<{ revenueTrend: { month: string; amount: number }[] }>("/superadmin/subscriptions/revenue-trend"),
        apiFetch<{ openCount: number }>("/superadmin/tickets/stats"),
        apiFetch<{ status: "up" | "degraded" | "down" }>("/superadmin/system/health-summary"),
        apiFetch<{ items: ControlRoomData["recentActivity"] }>("/superadmin/dashboard/activity-feed"),
      ]);

      const metricsData  = metrics.status  === "fulfilled" ? metrics.value  : null;
      const subsData     = subs.status     === "fulfilled" ? subs.value     : null;
      const ticketsData  = tickets.status  === "fulfilled" ? tickets.value  : null;
      const systemData   = system.status   === "fulfilled" ? system.value   : null;
      const activityData = activity.status === "fulfilled" ? activity.value : null;

      // Pipeline stats (riuso endpoint sales dashboard)
      const pipeline = await apiFetch<{
        kpi: { leadsCount: number; winRate: number };
        pipeline: { stage: string; value: number; count: number }[];
      }>("/superadmin/dashboard/stats").catch(() => null);

      // Quote requests pending
      const quoteStats = await apiFetch<{ pendingCount: number }>(
        "/superadmin/quote-requests/stats"
      ).catch(() => null);

      setData({
        mrr:                   metricsData?.mrr          ?? 0,
        arr:                   metricsData?.arr          ?? 0,
        activeTenants:         metricsData?.activeTenants ?? 0,
        totalTenants:          metricsData?.totalTenants  ?? 0,
        churnRate:             metricsData?.churnRate    ?? 0,
        winRate:               pipeline?.kpi?.winRate   ?? 0,
        systemStatus:          systemData?.status       ?? "degraded",
        openTickets:           ticketsData?.openCount   ?? 0,
        pendingQuotes:         quoteStats?.pendingCount ?? 0,
        expiringTrials:        0,
        revenueTrend:          subsData?.revenueTrend   ?? [],
        pipelineDistribution:  pipeline?.pipeline       ?? [],
        recentActivity:        activityData?.items      ?? [],
      });
    } catch (e) {
      console.error("Control Room load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">
          Sincronizzazione Control Room…
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-4">
        <p className="text-muted-foreground">Impossibile caricare i dati.</p>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Riprova
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-foreground">Control Room</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Panoramica live della piattaforma DoFlow
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Aggiorna</span>
        </Button>
      </div>

      {/* ── TIER 1: Business Health KPI (grid-cols-4) ───────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="MRR"
          value={fmtEur(data.mrr)}
          sub={`ARR: ${fmtEur(data.arr)}`}
          icon={CircleDollarSign}
          accent="hsl(214 100% 62%)"
          trend={{ value: 8, label: "vs mese prec." }}
          href="/superadmin/subscriptions"
        />
        <KpiCard
          label="Tenant Attivi"
          value={String(data.activeTenants)}
          sub={`su ${data.totalTenants} totali`}
          icon={Building2}
          accent="hsl(150 60% 45%)"
          trend={{ value: 2 }}
          href="/superadmin/tenants"
        />
        <KpiCard
          label="Churn Rate (30d)"
          value={fmtPct(data.churnRate)}
          icon={TrendingDown}
          accent={Number(data.churnRate) > 5 ? "hsl(0 70% 55%)" : "hsl(150 60% 45%)"}
          trend={{ value: Number(data.churnRate) > 3 ? -0.3 : 0.1 }}
          href="/superadmin/subscriptions"
        />
        <KpiCard
          label="Win Rate Pipeline"
          value={fmtPct(data.winRate)}
          icon={TrendingUp}
          accent="hsl(var(--chart-3))"
          trend={{ value: Number(data.winRate) >= 30 ? 5 : -2 }}
          href="/superadmin/sales/dashboard"
        />
      </div>

      {/* ── TIER 2: Operational Pulse (grid-cols-3) ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SystemHealthCard status={data.systemStatus} />

        <Link href="/superadmin/tickets">
          <Card className="border-none glass-card overflow-hidden relative group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer">
            <CardContent className="pt-5 pb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 text-amber-500">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Ticket Aperti
                  </p>
                  <p className={`text-2xl font-black mt-0.5 tabular-nums ${
                    data.openTickets > 10 ? "text-red-500" :
                    data.openTickets > 3  ? "text-amber-500" :
                    "text-foreground"
                  }`}>
                    {data.openTickets}
                  </p>
                </div>
              </div>
              {data.openTickets > 5 && (
                <Badge variant="destructive" className="text-xs">Urgente</Badge>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/superadmin/sales/quote-requests">
          <Card className="border-none glass-card overflow-hidden relative group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer">
            <CardContent className="pt-5 pb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-violet-50 dark:bg-violet-900/20 text-violet-500">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Preventivi in attesa
                  </p>
                  <p className="text-2xl font-black mt-0.5 tabular-nums text-foreground">
                    {data.pendingQuotes}
                  </p>
                </div>
              </div>
              {data.pendingQuotes > 0 && (
                <Badge variant="secondary" className="text-xs">Da gestire</Badge>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── TIER 3: Charts (grid-cols-2) ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Revenue Trend MoM */}
        <Card className="glass-card border-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Revenue Trend (6 mesi)
              </CardTitle>
              <Link
                href="/superadmin/finance/dashboard"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Dettaglio <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.revenueTrend.length > 0 ? (
              <div className="h-[220px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => fmtEur(v)}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderRadius: "12px",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                      formatter={(v: unknown) => [fmtEur(Number(v)), "Revenue"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                Dati non disponibili
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Funnel */}
        <Card className="glass-card border-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Pipeline per fase
              </CardTitle>
              <Link
                href="/superadmin/sales/dashboard"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Dettaglio <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.pipelineDistribution.length > 0 ? (
              <div className="h-[220px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.pipelineDistribution} layout="vertical" barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="stage"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderRadius: "12px",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                      formatter={(v: unknown) => [String(v), "Deals"]}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--chart-2))"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                Dati non disponibili
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── TIER 4: Activity Feed (full-width) ───────────────────────── */}
      <Card className="glass-card border-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Attività recente
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ActivityFeed items={data.recentActivity} />
        </CardContent>
      </Card>

    </div>
  );
}