"use client";

/**
 * dashboard-widgets.tsx — Tutti i widget della dashboard, divisi per piano.
 *
 * COMPONENT_MAP: mappa widgetId → componente React (usata da DashboardGrid)
 * Ogni widget è un componente autonomo con dati mockati/statici.
 * In produzione, ciascuno fa fetch dei propri dati via apiFetch.
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ArrowDown, ArrowUp, DollarSign, Users, ShoppingCart,
  FileText, Package, AlertTriangle, TrendingUp, Trophy,
} from "lucide-react";
import {
  Bar, BarChart, Line, LineChart, Pie, PieChart, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

// ─── Helper: KPI Card generica ───────────────────────────────────────────────

interface StatProps {
  title:   string;
  value:   string;
  trend:   string;
  trendUp: boolean;
  icon:    React.ComponentType<{ className?: string }>;
  prefix?: string;
}

function KpiCard({ title, value, trend, trendUp, icon: Icon, prefix }: StatProps) {
  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{prefix}{value}</div>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          {trendUp
            ? <ArrowUp className="h-3 w-3 text-emerald-500" />
            : <ArrowDown className="h-3 w-3 text-rose-500" />}
          <span className={trendUp ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>{trend}</span>
          <span>vs mese scorso</span>
        </p>
      </CardContent>
    </Card>
  );
}

// ─── STARTER WIDGETS ──────────────────────────────────────────────────────────

export function W_KpiNewLeads() {
  return <KpiCard title="Nuovi Lead" value="48" trend="+12%" trendUp={true} icon={Users} />;
}

export function W_KpiOpenOrders() {
  return <KpiCard title="Ordini Aperti" value="23" trend="+5%" trendUp={true} icon={ShoppingCart} />;
}

export function W_KpiQuoteValue() {
  return <KpiCard title="Valore Preventivi" value="18.400" trend="-3%" trendUp={false} icon={FileText} prefix="€" />;
}

const ordersTrendData = [
  { g: "1 Mar", v: 8 }, { g: "7 Mar", v: 14 }, { g: "14 Mar", v: 11 },
  { g: "21 Mar", v: 19 }, { g: "28 Mar", v: 23 }, { g: "oggi", v: 17 },
];

export function W_ChartOrdersTrend() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Trend Ordini</CardTitle>
        <CardDescription className="text-xs">Ultimi 30 giorni</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ordersTrendData}>
            <XAxis dataKey="g" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
            <Line type="monotone" dataKey="v" stroke="#4f46e5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function W_ListRecentQuotes() {
  const quotes = [
    { client: "Tecnologie Srl",   value: "€ 4.200",  status: "In attesa", color: "bg-amber-100 text-amber-700" },
    { client: "Studio Bianchi",   value: "€ 1.800",  status: "Inviato",   color: "bg-blue-100 text-blue-700"   },
    { client: "Rossi & Partners", value: "€ 7.500",  status: "In attesa", color: "bg-amber-100 text-amber-700" },
    { client: "Verde Trade",      value: "€ 950",    status: "Accettato", color: "bg-emerald-100 text-emerald-700" },
    { client: "Alfa Costruzioni", value: "€ 12.000", status: "In attesa", color: "bg-amber-100 text-amber-700" },
  ];
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Ultimi Preventivi</CardTitle>
        <CardDescription className="text-xs">5 più recenti</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 overflow-auto">
        {quotes.map((q, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
            <span className="text-sm font-medium truncate flex-1 mr-2">{q.client}</span>
            <span className="text-sm font-bold mr-3">{q.value}</span>
            <Badge className={`text-[10px] px-1.5 py-0 ${q.color} border-0`}>{q.status}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── PRO WIDGETS ──────────────────────────────────────────────────────────────

export function W_KpiRevenueMonth() {
  return <KpiCard title="Fatturato del Mese" value="34.820" trend="+8.2%" trendUp={true} icon={DollarSign} prefix="€" />;
}

export function W_KpiCashflowOverdue() {
  return <KpiCard title="Scaduto da Incassare" value="7.340" trend="+2 fatt." trendUp={false} icon={AlertTriangle} prefix="€" />;
}

export function W_KpiLowStock() {
  return <KpiCard title="Prodotti Sotto Scorta" value="6" trend="+2" trendUp={false} icon={Package} />;
}

const incomeExpData = [
  { m: "Gen", in: 28000, out: 18000 },
  { m: "Feb", in: 31000, out: 22000 },
  { m: "Mar", in: 34820, out: 19400 },
];

export function W_ChartIncomeVsExpenses() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Entrate vs Uscite</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={incomeExpData}>
            <XAxis dataKey="m" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} formatter={(v: number) => `€${v.toLocaleString()}`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="in"  name="Entrate" fill="#4f46e5" radius={[3,3,0,0]} />
            <Bar dataKey="out" name="Uscite"  fill="#e2e8f0" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function W_ListUnpaidInvoices() {
  const invoices = [
    { client: "Tecnologie Srl",   amount: "€ 3.200", days: "18gg scaduta",  red: true  },
    { client: "Alfa Costruzioni", amount: "€ 7.800", days: "32gg scaduta",  red: true  },
    { client: "Studio Bianchi",   amount: "€ 1.450", days: "5gg scaduta",   red: false },
  ];
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Fatture Non Pagate</CardTitle>
        <CardDescription className="text-xs">Richiede attenzione</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 overflow-auto">
        {invoices.map((inv, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
            <div className="flex-1 mr-2">
              <p className="text-sm font-medium truncate">{inv.client}</p>
              <p className={`text-xs ${inv.red ? "text-rose-500" : "text-amber-500"}`}>{inv.days}</p>
            </div>
            <span className={`text-sm font-bold ${inv.red ? "text-rose-600" : "text-foreground"}`}>{inv.amount}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── ENTERPRISE WIDGETS ───────────────────────────────────────────────────────

const marketData = [
  { name: "Nord Italia", value: 42, color: "#4f46e5" },
  { name: "Centro",      value: 28, color: "#7c3aed" },
  { name: "Sud",         value: 18, color: "#a78bfa" },
  { name: "Estero",      value: 12, color: "#c4b5fd" },
];

export function W_ChartMarketShare() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Quote di Mercato</CardTitle>
        <CardDescription className="text-xs">Per area geografica</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center min-h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={marketData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="50%" outerRadius="80%">
              {marketData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} formatter={(v: number) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

const heatmapData = [
  { r: "Lun", Gen: 12, Feb: 18, Mar: 22 },
  { r: "Mar", Gen: 19, Feb: 24, Mar: 31 },
  { r: "Mer", Gen: 8,  Feb: 15, Mar: 19 },
  { r: "Gio", Gen: 22, Feb: 28, Mar: 34 },
  { r: "Ven", Gen: 31, Feb: 35, Mar: 41 },
];

export function W_ChartSalesHeatmap() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Heatmap Vendite</CardTitle>
        <CardDescription className="text-xs">Ordini per giorno/mese</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={heatmapData}>
            <XAxis dataKey="r" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="Gen" fill="#c4b5fd" radius={[2,2,0,0]} />
            <Bar dataKey="Feb" fill="#7c3aed" radius={[2,2,0,0]} />
            <Bar dataKey="Mar" fill="#4f46e5" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function W_LeaderboardSellers() {
  const sellers = [
    { name: "Marco Ferri",    revenue: "€ 42.800", deals: 18, rank: 1 },
    { name: "Anna Conti",     revenue: "€ 38.200", deals: 14, rank: 2 },
    { name: "Luigi Moretti",  revenue: "€ 29.400", deals: 11, rank: 3 },
  ];
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" /> Classifica Venditori
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 overflow-auto">
        {sellers.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-lg">{medals[i]}</span>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-xs">
                {s.name.split(" ").map(p => p[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.deals} trattative</p>
            </div>
            <span className="text-sm font-bold text-indigo-600">{s.revenue}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── COMPONENT_MAP — usata da DashboardGrid ───────────────────────────────────
// Manteniamo anche le chiavi legacy per retrocompatibilità con layout salvati nel DB

export const COMPONENT_MAP: Record<string, React.ReactNode> = {
  // Starter
  "kpi_new_leads":           <W_KpiNewLeads />,
  "kpi_open_orders":         <W_KpiOpenOrders />,
  "kpi_quote_value":         <W_KpiQuoteValue />,
  "chart_orders_trend":      <W_ChartOrdersTrend />,
  "list_recent_quotes":      <W_ListRecentQuotes />,

  // Pro
  "kpi_revenue_month":         <W_KpiRevenueMonth />,
  "kpi_cashflow_overdue":      <W_KpiCashflowOverdue />,
  "kpi_low_stock":             <W_KpiLowStock />,
  "chart_income_vs_expenses":  <W_ChartIncomeVsExpenses />,
  "list_unpaid_invoices":      <W_ListUnpaidInvoices />,

  // Enterprise
  "chart_market_share":    <W_ChartMarketShare />,
  "chart_sales_heatmap":   <W_ChartSalesHeatmap />,
  "leaderboard_sellers":   <W_LeaderboardSellers />,

  // Legacy (retrocompatibilità con layout salvati nel DB)
  "stat_revenue":      <W_KpiRevenueMonth />,
  "stat_users":        <W_KpiNewLeads />,
  "stat_sales":        <W_KpiOpenOrders />,
  "stat_active":       <W_KpiLowStock />,
  "chart_overview":    <W_ChartIncomeVsExpenses />,
  "chart_main":        <W_ChartOrdersTrend />,
  "list_recent_sales": <W_ListRecentQuotes />,
};
