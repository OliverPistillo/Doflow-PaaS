"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, Users, RefreshCw, BarChart3, Activity } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface MetricsData {
  mrr: number;
  arr: number;
  activeTenants: number;
  churnRate: number;
  totalRevenue: number;
  tierDistribution: { name: string; value: number; fill: string }[];
}

function KpiCard({ title, value, icon: Icon, colorVar }: { title: string; value: string; icon: any; colorVar: string }) {
  return (
    <Card className="glass-card transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl overflow-hidden relative">
      <div 
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500"
        style={{ backgroundColor: colorVar }}
      />
      <CardContent className="p-6 relative z-10 flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black text-foreground mt-3 tracking-tight tabular-nums">{value}</h3>
        </div>
        <div 
          className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/50 transition-all duration-300 group-hover:scale-110 shadow-sm"
          style={{ color: colorVar, border: `1px solid color-mix(in srgb, ${colorVar} 20%, transparent)` }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function MetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<MetricsData>("/superadmin/metrics");
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const fmtCurrency = (n: number) => 
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-widest">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span>Metriche Platform</span>
            <span className="text-border">•</span>
            <span className="text-primary">SaaS KPIs</span>
          </div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">Metriche SaaS</h1>
          <p className="text-muted-foreground mt-2 text-sm font-medium">Monitoraggio MRR, ARR e adozione della piattaforma.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
            Live
          </Badge>
          <Button variant="outline" size="sm" onClick={loadMetrics} className="rounded-xl shadow-sm hover:border-primary/50 transition-colors gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Aggiorna
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="MRR (Monthly)" value={fmtCurrency(data.mrr)} icon={TrendingUp} colorVar="hsl(var(--chart-1))" />
        <KpiCard title="ARR (Annual)" value={fmtCurrency(data.arr)} icon={TrendingUp} colorVar="hsl(var(--chart-2))" />
        <KpiCard title="Tenant Attivi" value={String(data.activeTenants)} icon={Users} colorVar="hsl(var(--chart-3))" />
        <KpiCard title="Churn Rate" value={`${data.churnRate}%`} icon={Activity} colorVar="hsl(var(--chart-4))" />
      </div>

      {/* Charts / extra info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="glass-card shadow-lg p-6 flex flex-col items-center">
          <h3 className="font-bold text-lg mb-4 self-start">Distribuzione Piani (Tenants)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.tierDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.tierDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "12px" }}
                  itemStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-4">
            {data.tierDistribution.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-sm font-medium">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                <span>{entry.name}</span>
                <span className="text-muted-foreground ml-1">({entry.value})</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="glass-card shadow-lg p-6 flex flex-col justify-center items-center bg-primary/5 border-primary/20">
          <BarChart3 className="h-16 w-16 text-primary mb-4 opacity-50" />
          <h3 className="text-2xl font-black text-foreground mb-2">Ricavi dalle Fatture</h3>
          <p className="text-5xl font-black text-primary tabular-nums tracking-tighter drop-shadow-sm">
            {fmtCurrency(data.totalRevenue)}
          </p>
          <p className="text-muted-foreground mt-4 text-center max-w-sm">
            Somma di tutte le fatture in stato "pagato". Questo valore riflette gli incassi reali.
          </p>
        </Card>
      </div>
    </div>
  );
}
