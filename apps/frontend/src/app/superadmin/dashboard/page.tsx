"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
  Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Chart color helper ───────────────────────────────────────────────────────

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  isHero = false,
  iconType = "arrow",
  onClick,
  delay = 0,
}: {
  title: string;
  value: string;
  isHero?: boolean;
  iconType?: "arrow" | "sliders";
  onClick: () => void;
  delay?: number;
}) {
  const IconComp = iconType === "sliders" ? SlidersHorizontal : ArrowUpRight;

  return (
    <div
      className={`
        animate-fade-in-up rounded-2xl cursor-pointer group transition-all duration-300
        hover:-translate-y-0.5 hover:shadow-xl overflow-hidden relative
        ${isHero ? "kpi-hero-gradient" : "glass-card"}
      `}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      <div className="p-5 flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p
            className={`
              text-[10px] font-bold uppercase tracking-[0.14em] leading-tight mb-3
              ${isHero ? "kpi-label" : "text-muted-foreground"}
            `}
          >
            {title}
          </p>
          <h3
            className={`
              text-3xl font-black tracking-tight leading-none
              ${isHero ? "kpi-value" : "text-foreground"}
            `}
          >
            {value}
          </h3>
        </div>
        <div
          className={`
            h-9 w-9 flex items-center justify-center rounded-xl shrink-0 transition-all duration-300
            group-hover:scale-105
            ${isHero
              ? "bg-white/15 text-current backdrop-blur-sm"
              : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }
          `}
        >
          <IconComp className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, valueLabel = "Valore" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="text-muted-foreground text-xs font-medium mb-1">{label}</p>
      <p className="text-foreground font-bold">
        {valueLabel}: {formatCurrency(Number(payload[0]?.value) || 0)}
      </p>
    </div>
  );
}

// ─── Custom Pie Legend ────────────────────────────────────────────────────────

function PieLegend({ payload }: any) {
  if (!payload) return null;
  return (
    <div className="flex flex-col gap-3 pl-2">
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2.5 group/legend">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground group-hover/legend:text-foreground transition-colors leading-tight">
            {entry.value}
          </span>
          <span className="text-xs font-bold text-foreground ml-auto">
            ({entry.payload?.count ?? 0})
          </span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export default function SalesDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [activeCard, setActiveCard] = useState<CardContextType>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.stage) params.append("stages", filters.stage);
      if (filters.month) params.append("expectedCloseMonth", filters.month);
      if (filters.clientName) params.append("clientName", filters.clientName);

      const res = await apiFetch<DashboardData>(
        `/superadmin/dashboard/stats?${params.toString()}`
      );
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  // ── Loading State ───────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">
          Sincronizzazione metriche globali...
        </p>
      </div>
    );
  }

  if (!data) return null;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight leading-none">
              Quadro generale vendite
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="rounded-xl h-9 px-4 text-xs font-bold glass-card hover:bg-primary hover:text-primary-foreground transition-all shadow-none border-border/50"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Aggiorna Dati
          </Button>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up animate-delay-100">
        <GlobalFilterBar filters={filters} onFilterChange={setFilters} />
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Offerte in qualifica"
          value={String(data.kpi.leadsCount)}
          isHero={true}
          iconType="arrow"
          onClick={() => setActiveCard("QUALIFIED_LEADS")}
          delay={100}
        />
        <KpiCard
          title="Valore totale in pipeline"
          value={formatCurrency(data.kpi.totalValue)}
          iconType="sliders"
          onClick={() => setActiveCard("TOTAL_VALUE")}
          delay={150}
        />
        <KpiCard
          title="Base di vincita"
          value={`${data.kpi.winRate}%`}
          iconType="sliders"
          onClick={() => setActiveCard("WIN_RATE")}
          delay={200}
        />
        <KpiCard
          title="Media per deal"
          value={formatCurrency(data.kpi.avgDealValue)}
          iconType="arrow"
          onClick={() => setActiveCard("AVG_VALUE")}
          delay={250}
        />
      </div>

      {/* ── Charts Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Bar Chart */}
        <Card className="glass-card rounded-2xl animate-fade-in-up animate-delay-200">
          <CardHeader className="pb-0 pt-5 px-6">
            <div className="flex justify-between items-center">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                Valore dei preventivi per stato
              </CardTitle>
              <button
                className="h-8 w-8 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground
                           hover:bg-muted hover:text-foreground cursor-pointer transition-all"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-[300px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.pipeline} barCategoryGap="20%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.5}
                  />
                  <XAxis
                    dataKey="stage"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                    dy={8}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `€${v / 1000}k`}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
                  <Bar
                    dataKey="value"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={42}
                  >
                    {data.pipeline.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Donut Chart */}
        <Card className="glass-card rounded-2xl animate-fade-in-up animate-delay-300">
          <CardHeader className="pb-0 pt-5 px-6">
            <div className="flex justify-between items-center">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                Distribuzione offerte (Quantità)
              </CardTitle>
              <button
                className="h-8 w-8 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground
                           hover:bg-muted hover:text-foreground cursor-pointer transition-all"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-[300px] mt-2 flex items-center">
              <div className="h-full w-full flex flex-col md:flex-row items-center">
                <div className="h-full w-full md:w-3/5">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.pipeline}
                        dataKey="count"
                        nameKey="stage"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={3}
                        stroke="none"
                      >
                        {data.pipeline.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="w-full md:w-2/5 flex flex-col justify-center gap-3 p-3">
                  {data.pipeline.map((d, i) => (
                    <div key={i} className="flex items-center gap-2.5 group/leg">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-xs text-muted-foreground group-hover/leg:text-foreground transition-colors flex-1 truncate">
                        {d.stage}
                      </span>
                      <span className="text-xs font-bold text-foreground">({d.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Top Deals Chart ────────────────────────────────────────────── */}
      <Card className="glass-card rounded-2xl animate-fade-in-up animate-delay-400">
        <CardHeader className="pb-0 pt-5 px-6">
          <div className="flex justify-between items-center">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
              La miglior offerta per valore
            </CardTitle>
            <button
              className="h-8 w-8 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground
                         hover:bg-muted hover:text-foreground cursor-pointer transition-all"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="h-[260px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.topDeals}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `€${v / 1000}k`}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Closing This Month Alert ───────────────────────────────────── */}
      <div
        className="
          glass-card rounded-2xl p-5 flex justify-between items-center cursor-pointer
          group hover:shadow-xl transition-all animate-fade-in-up animate-delay-400
          relative overflow-hidden
        "
        onClick={() => setActiveCard("CLOSING_THIS_MONTH")}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-transparent to-transparent z-0" />
        <div className="relative z-10">
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.14em] mb-2">
            In chiusura (Mese corrente o selezionato)
          </p>
          <p className="text-3xl font-black text-foreground tracking-tight">
            {data.kpi.dealsClosingThisMonth}{" "}
            <span className="text-base font-medium text-muted-foreground tracking-normal">
              deals critici
            </span>
          </p>
        </div>
        <div
          className="
            relative z-10 h-10 w-10 rounded-xl flex items-center justify-center
            bg-muted/50 text-primary border border-primary/20
            group-hover:bg-primary group-hover:text-primary-foreground
            transition-all duration-300
          "
        >
          <ArrowUpRight className="h-5 w-5" />
        </div>
      </div>

      {/* ── Drill Down Sheet ───────────────────────────────────────────── */}
      <DrillDownSheet
        cardType={activeCard}
        globalFilters={filters}
        onClose={() => setActiveCard(null)}
      />
    </div>
  );
}