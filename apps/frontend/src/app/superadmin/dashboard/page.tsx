"use client";

import React, { useEffect, useState } from "react";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, CalendarDays, ArrowUpRight, AlertTriangle, Zap } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DrillDownSheet, CardContextType } from "./components/DrillDownSheet";
import { GlobalFilterBar, DashboardFilters } from "./components/GlobalFilterBar";
import { formatCurrency } from "./utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardData = {
  kpi: {
    leadsCount:            number;
    totalValue:            number;
    winRate:               number;
    avgDealValue:          number;
    dealsClosingThisMonth: number;
  };
  pipeline: { stage: string; value: number; count: number }[];
  topDeals: { name: string; client: string; value: number; stage: string }[];
};

// ─── Palette ──────────────────────────────────────────────────────────────────

const CHART_COLORS = {
  blue:   "#3b82f6",
  violet: "#8b5cf6",
  cyan:   "#06b6d4",
  emerald:"#10b981",
  rose:   "#f43f5e",
  amber:  "#f59e0b",
};

const PIE_COLORS = [CHART_COLORS.blue, CHART_COLORS.violet, CHART_COLORS.cyan, CHART_COLORS.emerald, CHART_COLORS.amber];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buona sera";
}
function formatDate() {
  return new Date().toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, accentColor, icon: Icon, onClick, trend
}: {
  title: string; value: string; sub?: string;
  accentColor: string; icon: any; onClick?: () => void;
  trend?: { label: string; up: boolean };
}) {
  return (
    <div
      onClick={onClick}
      className="glass-panel p-5 flex flex-col justify-between gap-3 cursor-pointer
        hover:border-white/20 hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)]
        transition-all duration-300 group relative overflow-hidden"
    >
      {/* glow orb */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-35 transition-opacity"
        style={{ backgroundColor: accentColor }}
      />
      <div className="relative flex justify-between items-start">
        <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">{title}</p>
        <div className="h-8 w-8 flex items-center justify-center rounded-lg"
          style={{ backgroundColor: accentColor + "20", color: accentColor }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="relative">
        <p className="text-3xl font-black text-white tabular-nums tracking-tight">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        {trend && (
          <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trend.up ? "text-emerald-400" : "text-rose-400"}`}>
            {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.label}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Custom Tooltip for dark charts ──────────────────────────────────────────

const DarkTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel-sm px-3 py-2 text-xs">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-bold" style={{ color: p.color || "#fff" }}>
          {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SalesDashboardPage() {
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({ stage: undefined, month: undefined, clientName: undefined });
  const [activeCard, setActiveCard] = useState<CardContextType | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Mappa DashboardFilters sui parametri del backend SuperadminDashboardService
      const params = new URLSearchParams();
      if (filters.stage)      params.append("stages",               filters.stage);
      if (filters.month)      params.append("expectedCloseMonth",   filters.month);
      if (filters.clientName) params.append("clientName",            filters.clientName);

      // Endpoint corretto: GET /superadmin/dashboard/stats
      const res = await apiFetch<DashboardData>(`/superadmin/dashboard/stats?${params}`);
      if (res && res.kpi && Array.isArray(res.pipeline)) {
        setData({
          kpi: {
            leadsCount:            Number(res.kpi?.leadsCount)            || 0,
            totalValue:            Number(res.kpi?.totalValue)            || 0,
            winRate:               Number(res.kpi?.winRate)               || 0,
            avgDealValue:          Number(res.kpi?.avgDealValue)          || 0,
            dealsClosingThisMonth: Number(res.kpi?.dealsClosingThisMonth) || 0,
          },
          pipeline: res.pipeline,
          topDeals: Array.isArray(res.topDeals) ? res.topDeals : [],
        });
      } else {
        setData({ kpi: { leadsCount: 0, totalValue: 0, winRate: 0, avgDealValue: 0, dealsClosingThisMonth: 0 }, pipeline: [], topDeals: [] });
      }
    } catch (e: any) {
      setError(e?.message || "Errore caricamento dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-blue-500 opacity-80" />
        <p className="text-sm text-slate-500 animate-pulse">Caricamento dashboard…</p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="glass-panel flex flex-col items-center justify-center py-24 gap-4">
        <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-white">Errore nel caricamento</h2>
        <p className="text-sm text-slate-400 text-center max-w-sm">{error || "Dati non disponibili"}</p>
        <Button onClick={loadData} variant="outline" className="mt-2 gap-2 border-white/10 text-white hover:bg-white/5">
          <RefreshCw className="h-4 w-4" /> Riprova
        </Button>
      </div>
    );
  }

  const { kpi, pipeline, topDeals } = data;
  const safePipeline = Array.isArray(pipeline) ? pipeline : [];
  const safeTopDeals = Array.isArray(topDeals)  ? topDeals  : [];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <>
      {activeCard && (
        <DrillDownSheet cardType={activeCard} onClose={() => setActiveCard(null)} globalFilters={filters} />
      )}

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
        <div className="glass-panel px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">
              <Zap className="h-3 w-3 text-blue-500" />
              <span>Business Intelligence</span>
              <span className="text-white/10">•</span>
              <span className="text-blue-400">Sales Ops</span>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">Quadro Generale</h1>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="capitalize">{formatDate()}</span>
              <span className="text-white/10">—</span>
              <span className="font-medium text-slate-300">{getGreeting()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              ● Live
            </Badge>
            <Button variant="ghost" size="sm" onClick={loadData}
              className="gap-2 text-slate-400 hover:text-white hover:bg-white/5 border border-white/10">
              <RefreshCw className="h-3.5 w-3.5" /> Aggiorna
            </Button>
          </div>
        </div>

        {/* ── GLOBAL FILTERS ──────────────────────────────────────────── */}
        <GlobalFilterBar filters={filters} onFilterChange={setFilters} />

        {/* ━━━ BENTO BOX GRID ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Lead Totali"
            value={kpi.leadsCount.toLocaleString("it-IT")}
            accentColor={CHART_COLORS.blue}
            icon={TrendingUp}
          onClick={() => setActiveCard("QUALIFIED_LEADS")}  // LEADS → QUALIFIED_LEADS
            trend={{ label: "Pipeline attiva", up: kpi.leadsCount > 0 }}
          />
          <KpiCard
            title="Valore Pipeline"
            value={formatCurrency(kpi.totalValue)}
            accentColor={CHART_COLORS.violet}
            icon={TrendingUp}
            onClick={() => setActiveCard("TOTAL_VALUE")}  // VALUE → TOTAL_VALUE
          />
          <KpiCard
            title="Win Rate"
            value={`${kpi.winRate}%`}
            accentColor={CHART_COLORS.emerald}
            icon={TrendingUp}
            onClick={() => setActiveCard("WIN_RATE")}
            trend={{ label: kpi.winRate >= 30 ? "Sopra target" : "Sotto target", up: kpi.winRate >= 30 }}
          />
          <KpiCard
            title="Media per Deal"
            value={formatCurrency(kpi.avgDealValue)}
            accentColor={CHART_COLORS.cyan}
            icon={TrendingUp}
            onClick={() => setActiveCard("AVG_VALUE")}
          />
        </div>

        {/* ── CLOSING ALERT BANNER ────────────────────────────────────── */}
        <div
          onClick={() => setActiveCard("CLOSING_THIS_MONTH")}
          className="glass-panel px-6 py-4 flex justify-between items-center cursor-pointer
            hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)] transition-all duration-300 group"
        >
          <div
            className="absolute inset-0 rounded-[1.25rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: "linear-gradient(90deg, rgba(59,130,246,0.06) 0%, transparent 100%)" }}
          />
          <div className="relative">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">
              In chiusura (Mese corrente o selezionato)
            </p>
            <p className="text-4xl font-black text-white tracking-tighter">
              {kpi.dealsClosingThisMonth}{" "}
              <span className="text-lg font-medium text-slate-400 tracking-normal">deals critici</span>
            </p>
          </div>
          <div className="relative h-11 w-11 rounded-xl border border-white/10 flex items-center justify-center text-slate-400
            group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500 transition-all duration-300">
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>

        {/* ── CHARTS ROW ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Pipeline Bar Chart — spans 3/5 */}
          <div className="glass-panel p-5 lg:col-span-3">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">
                Valore Pipeline per Fase
              </p>
              <ArrowUpRight className="h-4 w-4 text-slate-600" />
            </div>
            {safePipeline.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={safePipeline} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} dy={8} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={v => `€${v/1000}k`} tickLine={false} axisLine={false} />
                    <Tooltip content={<DarkTooltip formatter={(v: number) => formatCurrency(v)} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {safePipeline.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-600 text-sm">Nessun dato disponibile</div>
            )}
          </div>

          {/* Pie Distribution — spans 2/5 */}
          <div className="glass-panel p-5 lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">
                Distribuzione Offerte
              </p>
              <ArrowUpRight className="h-4 w-4 text-slate-600" />
            </div>
            {safePipeline.length > 0 ? (
              <div className="flex flex-col items-center h-[280px]">
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={safePipeline} dataKey="count" cx="50%" cy="50%"
                        innerRadius={55} outerRadius={85} paddingAngle={4} stroke="none">
                        {safePipeline.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<DarkTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                  {safePipeline.map((entry, i) => (
                    <div key={entry.stage} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-400">{entry.stage}</span>
                      <span className="font-bold text-white/60">({entry.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-600 text-sm">Nessun dato</div>
            )}
          </div>
        </div>

        {/* ── TOP DEALS TABLE ─────────────────────────────────────────── */}
        <div className="glass-panel p-5">
          <div className="flex justify-between items-center mb-4">
            <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">
              Top Deal <span className="text-blue-400">&mdash; Pipeline più calda</span>
            </p>
            <span className="text-[10px] text-slate-600">{safeTopDeals.length} deal</span>
          </div>

          {safeTopDeals.length > 0 ? (
            <div className="space-y-1">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_1fr_120px_120px] gap-4 px-3 pb-2 text-[10px] font-bold tracking-widest uppercase text-slate-600 border-b border-white/[0.05]">
                <span>Deal</span><span>Cliente</span><span className="text-right">Valore</span><span className="text-right">Fase</span>
              </div>
              {safeTopDeals.map((deal, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_120px_120px] gap-4 px-3 py-2.5 rounded-lg
                  hover:bg-white/[0.025] transition-colors group">
                  <span className="font-semibold text-sm text-white/80 truncate group-hover:text-white transition-colors">{deal.name}</span>
                  <span className="text-sm text-slate-400 truncate">{deal.client}</span>
                  <span className="text-sm font-bold text-right text-blue-400 tabular-nums">{formatCurrency(deal.value)}</span>
                  <span className="text-right">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400">
                      {deal.stage}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-600 py-10 text-sm">Nessun deal trovato</p>
          )}
        </div>

      </div>
    </>
  );
}