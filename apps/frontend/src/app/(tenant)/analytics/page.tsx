"use client";

import { useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Users,
  ShoppingCart, FileText, ArrowUpRight, Download, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList,
} from "recharts";

// ─── Demo Data ────────────────────────────────────────────────────────────────

const REVENUE_DATA = [
  { month: "Ago", revenue: 28400, expenses: 18200, profit: 10200 },
  { month: "Set", revenue: 32100, expenses: 19500, profit: 12600 },
  { month: "Ott", revenue: 29800, expenses: 17800, profit: 12000 },
  { month: "Nov", revenue: 35200, expenses: 21000, profit: 14200 },
  { month: "Dic", revenue: 41800, expenses: 23500, profit: 18300 },
  { month: "Gen", revenue: 38600, expenses: 22100, profit: 16500 },
  { month: "Feb", revenue: 44200, expenses: 24800, profit: 19400 },
];

const PIPELINE_FUNNEL = [
  { name: "Lead",      value: 248, fill: "#6366f1" },
  { name: "Contatto",  value: 160, fill: "#8b5cf6" },
  { name: "Proposta",  value: 95,  fill: "#a78bfa" },
  { name: "Negoziazione", value: 58, fill: "#c4b5fd" },
  { name: "Vinto",     value: 31,  fill: "#10b981" },
];

const SECTOR_DATA = [
  { name: "Tech & Software", value: 38, fill: "#6366f1" },
  { name: "Manifattura",     value: 22, fill: "#10b981" },
  { name: "Servizi Profess.", value: 18, fill: "#f59e0b" },
  { name: "Retail",          value: 12, fill: "#f43f5e" },
  { name: "Altro",           value: 10, fill: "#94a3b8" },
];

const TOP_CLIENTS = [
  { name: "Luxor Media S.r.l.",     sector: "Media",    revenue: "€ 95.000", deals: 4, trend: +22, growth: true },
  { name: "Nextech S.r.l.",         sector: "Tech",     revenue: "€ 72.400", deals: 6, trend: +15, growth: true },
  { name: "Alpine Ventures",        sector: "Finance",  revenue: "€ 58.200", deals: 3, trend: +8,  growth: true },
  { name: "Brera Design Studio",    sector: "Design",   revenue: "€ 41.600", deals: 7, trend: -4,  growth: false },
  { name: "Manifattura Lombarda",   sector: "Industry", revenue: "€ 36.800", deals: 2, trend: +31, growth: true },
  { name: "Editoria Moderna",       sector: "Media",    revenue: "€ 28.300", deals: 5, trend: -12, growth: false },
];

const MONTHLY_LEADS = [
  { month: "Ago", leads: 28, converted: 9 },
  { month: "Set", leads: 35, converted: 12 },
  { month: "Ott", leads: 31, converted: 10 },
  { month: "Nov", leads: 42, converted: 15 },
  { month: "Dic", leads: 38, converted: 14 },
  { month: "Gen", leads: 45, converted: 18 },
  { month: "Feb", leads: 52, converted: 21 },
];

const HEATMAP_DATA = [
  { day: "Lun", h8: 3, h10: 8, h12: 5, h14: 11, h16: 7, h18: 2 },
  { day: "Mar", h8: 5, h10: 12, h12: 9, h14: 14, h16: 10, h18: 4 },
  { day: "Mer", h8: 4, h10: 10, h12: 7, h14: 13, h16: 9, h18: 3 },
  { day: "Gio", h8: 6, h10: 14, h12: 11, h14: 16, h16: 12, h18: 5 },
  { day: "Ven", h8: 7, h10: 13, h12: 10, h14: 15, h16: 8, h18: 1 },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, delta, up, icon: Icon, sub, color, bg }: {
  title: string; value: string; delta: string; up: boolean;
  icon: React.ComponentType<{className?: string}>; sub?: string; color: string; bg: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", bg)}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-3">
          {up ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> : <TrendingDown className="h-3.5 w-3.5 text-rose-600" />}
          <span className={cn("text-xs font-semibold", up ? "text-emerald-600" : "text-rose-600")}>{delta}</span>
          <span className="text-xs text-muted-foreground">vs. mese precedente</span>
        </div>
      </CardContent>
      <div className={cn("absolute bottom-0 left-0 h-0.5 w-full", bg.replace("bg-", "bg-").replace("/30", ""))} />
    </Card>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">
            {typeof p.value === "number" && p.name?.toLowerCase().includes("rev") || p.name?.toLowerCase().includes("exp") || p.name?.toLowerCase().includes("prof")
              ? `€ ${p.value.toLocaleString("it-IT")}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [period, setPeriod] = useState("7m");

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 text-xs">Enterprise</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Business intelligence e report avanzati</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">Ultimi 3 mesi</SelectItem>
              <SelectItem value="7m">Ultimi 7 mesi</SelectItem>
              <SelectItem value="12m">Ultimo anno</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 h-4 w-4" /> Esporta PDF
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Fatturato Totale"     value="€ 250.100" delta="+14.2%"  up icon={DollarSign}  sub="YTD 2026"                    color="text-indigo-600"  bg="bg-indigo-100 dark:bg-indigo-950/40" />
        <KpiCard title="Nuovi Lead"           value="269"       delta="+18.5%"  up icon={Users}       sub="negli ultimi 7 mesi"          color="text-emerald-600" bg="bg-emerald-100 dark:bg-emerald-950/40" />
        <KpiCard title="Tasso Conversione"    value="12,5%"     delta="+2.1pp"  up icon={TrendingUp}  sub="lead → cliente"              color="text-amber-600"   bg="bg-amber-100 dark:bg-amber-950/40" />
        <KpiCard title="Valore Medio Deal"    value="€ 28.400"  delta="-3.2%"  up={false} icon={BarChart3} sub="deal chiusi nel periodo" color="text-violet-600"  bg="bg-violet-100 dark:bg-violet-950/40" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="revenue">
        <TabsList className="h-9">
          <TabsTrigger value="revenue" className="text-xs">Ricavi & Costi</TabsTrigger>
          <TabsTrigger value="pipeline" className="text-xs">Pipeline CRM</TabsTrigger>
          <TabsTrigger value="clients" className="text-xs">Top Clienti</TabsTrigger>
          <TabsTrigger value="leads" className="text-xs">Lead & Conversioni</TabsTrigger>
        </TabsList>

        {/* ── Revenue ── */}
        <TabsContent value="revenue" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Area chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Andamento Ricavi vs Costi</CardTitle>
                <CardDescription className="text-xs">Confronto mensile — ultimi 7 mesi</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={REVENUE_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="revenue" name="Ricavi" stroke="#6366f1" fill="url(#gRev)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" name="Costi" stroke="#f43f5e" fill="url(#gExp)" strokeWidth={2} />
                    <Line type="monotone" dataKey="profit" name="Profitto" stroke="#10b981" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ricavi per Settore</CardTitle>
                <CardDescription className="text-xs">Distribuzione % clienti</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={SECTOR_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                      {SECTOR_DATA.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {SECTOR_DATA.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.fill }} />
                        <span className="text-muted-foreground">{s.name}</span>
                      </div>
                      <span className="font-medium">{s.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Pipeline ── */}
        <TabsContent value="pipeline" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Funnel di Vendita</CardTitle>
                <CardDescription className="text-xs">Da Lead a Cliente — ultimi 7 mesi</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mt-2">
                  {PIPELINE_FUNNEL.map((stage, i) => {
                    const pct = Math.round((stage.value / PIPELINE_FUNNEL[0].value) * 100);
                    return (
                      <div key={stage.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{stage.name}</span>
                          <span className="tabular-nums text-muted-foreground">{stage.value} ({pct}%)</span>
                        </div>
                        <div className="h-6 rounded-lg overflow-hidden bg-muted/40">
                          <div
                            className="h-full rounded-lg transition-all"
                            style={{ width: `${pct}%`, backgroundColor: stage.fill }}
                          />
                        </div>
                        {i < PIPELINE_FUNNEL.length - 1 && (
                          <p className="text-[10px] text-muted-foreground text-right">
                            → {Math.round((PIPELINE_FUNNEL[i+1].value / stage.value) * 100)}% avanzamento
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Velocità Pipeline</CardTitle>
                <CardDescription className="text-xs">Giorni medi per fase</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={[
                    { fase: "Lead→Cont.", giorni: 3.2 },
                    { fase: "Cont.→Prop.", giorni: 8.5 },
                    { fase: "Prop.→Neg.", giorni: 12.1 },
                    { fase: "Neg.→Chiuso", giorni: 6.4 },
                  ]} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `${v}gg`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="fase" tick={{ fontSize: 10 }} width={70} />
                    <Tooltip formatter={(v: any) => `${v} giorni`} />
                    <Bar dataKey="giorni" name="Giorni" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Top Clients ── */}
        <TabsContent value="clients" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Clienti per Fatturato</CardTitle>
              <CardDescription className="text-xs">Periodo corrente YTD 2026</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {TOP_CLIENTS.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <span className="text-sm font-bold tabular-nums text-muted-foreground w-5 shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.sector} · {c.deals} deal</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums">{c.revenue}</p>
                      <div className={cn("flex items-center gap-1 text-xs justify-end", c.growth ? "text-emerald-600" : "text-rose-500")}>
                        {c.growth ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {c.growth ? "+" : ""}{c.trend}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Leads ── */}
        <TabsContent value="leads" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Lead e Conversioni Mensili</CardTitle>
              <CardDescription className="text-xs">Nuovi lead vs. lead convertiti a cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={MONTHLY_LEADS} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="leads" name="Nuovi Lead" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="converted" name="Convertiti" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
