// Percorso: C:\Doflow\apps\frontend\src\app\superadmin\dashboard\page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, Loader2, RefreshCw, TrendingUp, TrendingDown, CalendarDays, Package, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DrillDownSheet, CardContextType } from "./components/DrillDownSheet";
import { GlobalFilterBar, DashboardFilters } from "./components/GlobalFilterBar";
import { formatCurrency } from "./utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// --- TIPI Dati Backend ---
type DashboardData = {
  kpi: {
    leadsCount: number;
    totalValue: number;
    winRate: number;
    avgDealValue: number;
    dealsClosingThisMonth: number;
  };
  pipeline: { stage: string; value: number; count: number }[];
  topDeals: { name: string; client: string; value: number; stage: string }[];
};

// ─── Greeting helper ──────────────────────────────────────────────────────────

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
  title,
  value,
  colorVar,
  trend,
  trendUp,
  onClick,
  className = "glass-card bg-card text-card-foreground", // Default si adatta al tema Dark/Light
}: {
  title:    string;
  value:    string;
  colorVar: string;
  trend?:   string;
  trendUp?: boolean;
  onClick:  () => void;
  className?: string;
}) {
  return (
    <Card
      className={`${className} transition-all duration-300 cursor-pointer group hover:-translate-y-1 hover:shadow-2xl overflow-hidden relative border-none`}
      onClick={onClick}
    >
      {/* Glow effect */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500 pointer-events-none"
        style={{ backgroundColor: colorVar }}
      />
      <CardContent className="p-6 relative z-10">
        <div className="flex justify-between items-start">
          {/* Sostituito text-muted-foreground con opacity-70 per ereditare correttamente il colore padre */}
          <p className="text-xs font-bold opacity-70 uppercase tracking-widest">{title}</p>
          <div
            className="h-9 w-9 flex items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 shadow-sm"
            style={{ 
              backgroundColor: `color-mix(in srgb, ${colorVar} 15%, transparent)`,
              color: colorVar, 
              border: `1px solid color-mix(in srgb, ${colorVar} 30%, transparent)` 
            }}
          >
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
        {/* Rimosso text-foreground per permettere alle card custom (es. sa-card-dark) di imporre il bianco */}
        <h3 className="text-3xl font-black mt-3 tracking-tight tabular-nums" style={{ fontFamily: "'Urbanist', sans-serif" }}>
          {value}
        </h3>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${
            trendUp ? "text-emerald-500" : "text-rose-500"
          }`}>
            {trendUp
              ? <TrendingUp className="h-3.5 w-3.5" />
              : <TrendingDown className="h-3.5 w-3.5" />}
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SalesDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // STATO GLOBALE FILTRI
  const [filters, setFilters] = useState<DashboardFilters>({});

  // STATO CARD ATTIVA (Drill-down Context)
  const [activeCard, setActiveCard] = useState<CardContextType>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.stage) params.append("stages", filters.stage);
      if (filters.month) params.append("expectedCloseMonth", filters.month);
      if (filters.clientName) params.append("clientName", filters.clientName);

      const res = await apiFetch<DashboardData>(`/superadmin/dashboard/stats?${params.toString()}`);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── LOADING STATE ──────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="loading-state">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Sincronizzazione metriche globali…</p>
      </div>
    );
  }

  // ─── ERROR STATE ────────────────────────────────────────────────────────────

  if (!data || !data.kpi || !Array.isArray(data.pipeline) || !Array.isArray(data.topDeals)) {
    return (
      <div className="error-state animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="error-box">
          <div className="error-icon">
            <TrendingDown className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Impossibile caricare le statistiche</h2>
          <p className="text-muted-foreground mt-2 max-w-md text-center">
            Il server ha riscontrato un errore (es. database non sincronizzato) o i dati ricevuti non sono validi.
          </p>
          <Button onClick={loadData} variant="outline" className="mt-6 gap-2">
            <RefreshCw className="h-4 w-4" /> Riprova
          </Button>
        </div>
      </div>
    );
  }

  // ─── MAIN RENDER ────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-content animate-fadeIn">

      {/* ── 1. Hero / Greeting card ──────────────────────────────────── */}
      <div className="dashboard-hero" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="dashboard-hero-meta">
            <span>Business Intelligence</span>
            <span className="dot">•</span>
            <span className="accent">Sales Ops</span>
          </div>
          <h1 className="dashboard-hero-title">Quadro Generale</h1>
          <div className="dashboard-hero-sub">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="capitalize">{formatDate()}</span>
            <span style={{ color: 'hsl(var(--border))' }}>—</span>
            <span className="font-medium" style={{ color: 'hsl(var(--foreground))' }}>{getGreeting()}</span>
          </div>
        </div>
        <div className="dashboard-hero-actions">
          <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
            Live
          </Badge>
          <Button variant="outline" size="sm" onClick={loadData} className="rounded-xl shadow-sm hover:border-primary/50 transition-colors gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Aggiorna
          </Button>
        </div>
      </div>

      {/* ── 2. BARRA FILTRI GLOBALE ──────────────────────────────────── */}
      <div className="animate-fadeInUp" style={{ animationDelay: "0.1s" }}>
        <GlobalFilterBar filters={filters} onFilterChange={setFilters} />
      </div>

      {/* ── 3. KPI CARDS ──────────────────────────────────────────────── */}
      <div className="kpi-grid animate-fadeInUp" style={{ animationDelay: "0.2s" }}>
        <KpiCard
          title="Offerte in qualifica"
          value={String(data.kpi.leadsCount)}
          colorVar="#3b82f6" // Azzurro acceso visibile su sfondo scuro
          trend="+8% vs mese precedente"
          trendUp
          onClick={() => setActiveCard('QUALIFIED_LEADS')}
          className="sa-card-logistics text-white" // Stile custom della demo
        />
        <KpiCard
          title="Valore filtrato"
          value={formatCurrency(data.kpi.totalValue)}
          colorVar="#a78bfa" // Viola acceso
          trend="Pipeline attiva"
          trendUp
          onClick={() => setActiveCard('TOTAL_VALUE')}
          className="sa-card-dark text-white" // Stile dark minimale della demo
        />
        <KpiCard
          title="Tasso di vincita"
          value={`${data.kpi.winRate}%`}
          colorVar="hsl(var(--chart-3))"
          trend={data.kpi.winRate >= 30 ? "Sopra target" : "Sotto target"}
          trendUp={data.kpi.winRate >= 30}
          onClick={() => setActiveCard('WIN_RATE')}
          className="glass-card bg-card text-card-foreground" // Stile standard adattivo (Light/Dark)
        />
        <KpiCard
          title="Media per deal"
          value={formatCurrency(data.kpi.avgDealValue)}
          colorVar="hsl(var(--chart-4))"
          trend="Valore medio"
          trendUp
          onClick={() => setActiveCard('AVG_VALUE')}
          className="glass-card bg-card text-card-foreground" // Stile standard adattivo (Light/Dark)
        />
      </div>

      {/* ── 4. Alert Row (Chiusura Mese) ──────────────────────────────── */}
      <div className="animate-fadeInUp" style={{ animationDelay: "0.3s" }}>
        <Card
          className="sa-card-yellow border-none cursor-pointer hover:shadow-lg transition-all mb-6 group"
          onClick={() => setActiveCard('CLOSING_THIS_MONTH')}
        >
          <CardContent className="flex items-center justify-between p-6">
            <div>
              {/* Il testo nero/scuro è forzato perché la card gialla lo richiede sempre */}
              <p className="text-sm font-bold uppercase tracking-wider text-yellow-950/60">
                In chiusura (Mese corrente o selezionato)
              </p>
              <p className="text-3xl font-black text-yellow-950 mt-1" style={{ fontFamily: "'Urbanist', sans-serif" }}>
                {data.kpi.dealsClosingThisMonth}{' '}
                <span className="text-lg font-medium text-yellow-950/70">deals critici</span>
              </p>
            </div>
            <div className="h-12 w-12 bg-yellow-950/10 rounded-full flex items-center justify-center text-yellow-950 transition-transform group-hover:scale-110">
              <ArrowUpRight className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 5. Charts Area ────────────────────────────────────────────── */}
      <div className="charts-grid animate-fadeInUp" style={{ animationDelay: "0.4s" }}>

        {/* Pipeline Bar Chart */}
        <Card className="glass-card bg-card text-card-foreground border-none">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Valore pipeline per fase
              </CardTitle>
              <div className="h-8 w-8 bg-muted/50 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.pipeline}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="stage"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `€${v / 1000}k`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderRadius: '12px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      fontFamily: "'Urbanist', sans-serif",
                      color: 'hsl(var(--foreground))' // <-- RISOLVE IL PROBLEMA DEL TESTO IN DARK MODE
                    }}
                    formatter={(val: unknown) => [formatCurrency(Number(val) || 0), 'Valore']}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="glass-card bg-card text-card-foreground border-none">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Distribuzione offerte (Quantità)
              </CardTitle>
              <div className="h-8 w-8 bg-muted/50 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] mt-4 flex flex-col md:flex-row items-center">
              <div className="h-full w-full md:w-2/3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.pipeline}
                      dataKey="count"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {data.pipeline.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--card))',
                        fontFamily: "'Urbanist', sans-serif",
                        color: 'hsl(var(--foreground))' // <-- RISOLVE IL PROBLEMA DEL TESTO IN DARK MODE
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legenda Autogenerata */}
              <div className="w-full md:w-1/3 flex flex-col justify-center gap-4 p-4 text-right">
                {data.pipeline.map((d, i) => (
                  <div key={i} className="flex items-center justify-end gap-3 group">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: `hsl(var(--chart-${(i % 5) + 1}))` }} />
                    <span className="text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors">{d.stage}</span>
                    <span className="text-sm font-black text-foreground">({d.count})</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 6. Top Deals Chart ────────────────────────────────────────── */}
      <div className="animate-fadeInUp" style={{ animationDelay: "0.5s" }}>
        <Card className="glass-card bg-card text-card-foreground border-none">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Le migliori offerte per valore
              </CardTitle>
              <div className="h-8 w-8 bg-muted/50 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topDeals} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderRadius: '12px',
                      border: '1px solid hsl(var(--border))',
                      fontFamily: "'Urbanist', sans-serif",
                      color: 'hsl(var(--foreground))' // <-- RISOLVE IL PROBLEMA DEL TESTO IN DARK MODE
                    }}
                    formatter={(val: unknown) => [formatCurrency(Number(val) || 0), 'Valore']}
                  />
                  <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 7. DRILL DOWN SHEET ───────────────────────────────────────── */}
      <DrillDownSheet
        cardType={activeCard}
        globalFilters={filters}
        onClose={() => setActiveCard(null)}
      />

    </div>
  );
}