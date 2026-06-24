"use client";

/**
 * dashboard-widgets.tsx — Widget dashboard stile shadcn-admin.
 * Design: Card con gradient sottile, badge trend, grafici recharts.
 */

import React from "react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart,
  FileText, Package, AlertTriangle, Trophy, Target, GitFork,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, Line, LineChart,
  Pie, PieChart, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";


// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiProps {
  title:   string;
  value:   string;
  delta:   string;
  up:      boolean;
  icon:    React.ComponentType<{ className?: string }>;
  sub?:    string;
}

function KpiCard({ title, value, delta, up, icon: Icon, sub }: KpiProps) {
  return (
    <Card className="h-full bg-gradient-to-t from-card to-primary/5 shadow-xs overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">{title}</CardDescription>
        <Badge variant="outline" className={cn(
          "text-[10px] px-1.5 py-0.5 flex items-center gap-1",
          up ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30" : "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/30",
        )}>
          {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {delta}
        </Badge>
      </CardHeader>
      <CardContent className="pt-1 pb-4">
        <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── STARTER WIDGETS ──────────────────────────────────────────────────────────

export function W_KpiNewLeads() {
  return <KpiCard title="Nuovi Lead" value="0" delta="0%" up icon={Users} sub="vs. mese scorso" />;
}
export function W_KpiOpenOrders() {
  return <KpiCard title="Ordini Aperti" value="0" delta="0%" up icon={ShoppingCart} sub="in lavorazione" />;
}
export function W_KpiQuoteValue() {
  return <KpiCard title="Valore Preventivi" value="€ 0" delta="0%" up={false} icon={FileText} sub="ultimi 30 giorni" />;
}

const ordersTrendData: any[] = [];

export function W_ChartOrdersTrend() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Trend Ordini</CardTitle>
        <CardDescription className="text-xs">Ultimi 30 giorni</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={ordersTrendData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="gradOrd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="g" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12, border: "1px solid hsl(var(--border))" }} />
            <Area type="monotone" dataKey="v" name="Ordini" stroke="#4f46e5" strokeWidth={2} fill="url(#gradOrd)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function W_ListRecentQuotes() {
const quotes: any[] = [];
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Ultimi Preventivi</CardTitle>
        <CardDescription className="text-xs">Più recenti</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Cliente</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Valore</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Stato</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q, i) => (
              <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-medium truncate max-w-[140px]">{q.client}</td>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums">{q.value}</td>
                <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", q.cls)}>{q.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── PRO WIDGETS ──────────────────────────────────────────────────────────────

export function W_KpiRevenueMonth() {
  return <KpiCard title="Fatturato del Mese" value="€ 0" delta="0%" up icon={DollarSign} sub="obiettivo: € 40.000" />;
}
export function W_KpiCashflowOverdue() {
  return <KpiCard title="Scaduto da Incassare" value="€ 0" delta="0 fatt." up={false} icon={AlertTriangle} sub="richiede attenzione" />;
}
export function W_KpiLowStock() {
  return <KpiCard title="Prodotti Sotto Scorta" value="0" delta="0" up={false} icon={Package} sub="vs. settimana scorsa" />;
}

const incomeExpData: any[] = [];

export function W_ChartIncomeVsExpenses() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Entrate vs Uscite</CardTitle>
        <CardDescription className="text-xs">Ultimi 4 mesi</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={incomeExpData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="m" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12, border: "1px solid hsl(var(--border))" }} formatter={(v: number) => [`€${v.toLocaleString("it-IT")}`, ""]} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="in"  name="Entrate" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="out" name="Uscite"  fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function W_ListUnpaidInvoices() {
  const invoices: any[] = [];
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          Fatture Non Pagate
          <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{invoices.length}</Badge>
        </CardTitle>
        <CardDescription className="text-xs">Richiede attenzione</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        <table className="w-full text-sm">
          <tbody>
            {invoices.map((inv, i) => (
              <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium truncate">{inv.client}</p>
                  <p className={cn("text-xs mt-0.5", inv.red ? "text-rose-500" : "text-amber-500")}>{inv.days}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={cn("font-bold tabular-nums", inv.red ? "text-rose-600" : "text-foreground")}>{inv.amount}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── ENTERPRISE WIDGETS ───────────────────────────────────────────────────────

const marketData: any[] = [];

export function W_ChartMarketShare() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Quote di Mercato</CardTitle>
        <CardDescription className="text-xs">Per area geografica</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={marketData}
              dataKey="value" nameKey="name"
              cx="50%" cy="45%"
              innerRadius="45%" outerRadius="70%"
              paddingAngle={3}
            >
              {marketData.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12, border: "1px solid hsl(var(--border))" }} formatter={(v: number) => [`${v}%`, ""]} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

const heatmapData: any[] = [];

export function W_ChartSalesHeatmap() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Volume Vendite</CardTitle>
        <CardDescription className="text-xs">Ordini per giorno / mese</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={heatmapData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="r" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12, border: "1px solid hsl(var(--border))" }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="Gen" fill="#c4b5fd" radius={[3, 3, 0, 0]} maxBarSize={16} />
            <Bar dataKey="Feb" fill="#7c3aed" radius={[3, 3, 0, 0]} maxBarSize={16} />
            <Bar dataKey="Mar" fill="#4f46e5" radius={[3, 3, 0, 0]} maxBarSize={16} />
            <Bar dataKey="Apr" fill="#312e81" radius={[3, 3, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function W_LeaderboardSellers() {
  const sellers: any[] = [];
  const medals = ["🥇", "🥈", "🥉", "4°"];
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" /> Top Venditori
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 overflow-auto pt-1">
        {sellers.map((s, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="text-base w-5 text-center shrink-0">{medals[i]}</span>
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                  {s.name?.split(" ").map((p: string) => p[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate leading-tight">{s.name}</p>
                <p className="text-[10px] text-muted-foreground">{s.deals} trattative</p>
              </div>
              <span className="text-sm font-bold text-indigo-600 tabular-nums shrink-0">{s.revenue}</span>
            </div>
            <div className="ml-7 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${s.pct}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── CRM WIDGETS ──────────────────────────────────────────────────────────────

export function W_KpiLeadConversionRate() {
  return (
    <KpiCard
      title="Tasso Conversione Lead"
      value="18.4%"
      delta="+2.1pp"
      up
      icon={Target}
      sub="Lead → Chiuso (ultimi 30gg)"
    />
  );
}

const funnelData: any[] = [];

export function W_ChartLeadFunnel() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <GitFork className="h-4 w-4 text-indigo-500" />
          Funnel Pipeline
        </CardTitle>
        <CardDescription className="text-xs">Lead per fase — ultimi 30gg</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={funnelData}
            layout="vertical"
            margin={{ top: 4, right: 40, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              type="category" dataKey="stage"
              tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
              width={72}
            />
            <Tooltip
              contentStyle={{ borderRadius: "8px", fontSize: 12, border: "1px solid hsl(var(--border))" }}
              formatter={(v: number) => [`${v} lead`, ""]}
            />
            <Bar dataKey="count" name="Lead" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {funnelData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

const TOP_DEALS: any[] = [];

export function W_ListTopDeals() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <GitFork className="h-4 w-4 text-indigo-500" />
          Top Deal Pipeline
        </CardTitle>
        <CardDescription className="text-xs">Trattative attive per valore</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Deal</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Fase</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Valore</th>
            </tr>
          </thead>
          <tbody>
            {TOP_DEALS.map((deal, i) => (
              <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-[10px] dark:bg-indigo-950/50 dark:text-indigo-300">
                        {deal.contact?.split(" ").map((p: string) => p[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm">{deal.name}</p>
                      <p className="text-[10px] text-muted-foreground">{deal.contact}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", deal.stageColor)}>
                    {deal.stage}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums text-indigo-600">
                  {deal.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── COMPONENT_MAP ────────────────────────────────────────────────────────────

export const COMPONENT_MAP: Record<string, React.ReactNode> = {
  // Starter
  "kpi_new_leads":          <W_KpiNewLeads />,
  "kpi_open_orders":        <W_KpiOpenOrders />,
  "kpi_quote_value":        <W_KpiQuoteValue />,
  "chart_orders_trend":     <W_ChartOrdersTrend />,
  "list_recent_quotes":     <W_ListRecentQuotes />,
  // Starter — CRM
  "kpi_lead_conversion":    <W_KpiLeadConversionRate />,
  "chart_lead_funnel":      <W_ChartLeadFunnel />,
  // Pro
  "kpi_revenue_month":         <W_KpiRevenueMonth />,
  "kpi_cashflow_overdue":      <W_KpiCashflowOverdue />,
  "kpi_low_stock":             <W_KpiLowStock />,
  "chart_income_vs_expenses":  <W_ChartIncomeVsExpenses />,
  "list_unpaid_invoices":      <W_ListUnpaidInvoices />,
  // Pro — CRM
  "list_top_deals":            <W_ListTopDeals />,
  // Enterprise
  "chart_market_share":    <W_ChartMarketShare />,
  "chart_sales_heatmap":   <W_ChartSalesHeatmap />,
  "leaderboard_sellers":   <W_LeaderboardSellers />,
  // Legacy
  "stat_revenue":      <W_KpiRevenueMonth />,
  "stat_users":        <W_KpiNewLeads />,
  "stat_sales":        <W_KpiOpenOrders />,
  "stat_active":       <W_KpiLowStock />,
  "chart_overview":    <W_ChartIncomeVsExpenses />,
  "chart_main":        <W_ChartOrdersTrend />,
  "list_recent_sales": <W_ListRecentQuotes />,
};
