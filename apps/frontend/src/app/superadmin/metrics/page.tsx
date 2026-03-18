// Percorso: C:\Doflow\apps\frontend\src\app\superadmin\metrics\page.tsx

"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, Users, RefreshCw, BarChart3, Activity, AlertTriangle } from "lucide-react";
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

function KpiCard({ title, value, icon: Icon, colorVar }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; colorVar: string }) {
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
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<MetricsData>("/superadmin/metrics");
      // Defensive: assicuriamoci che la risposta sia valida
      if (res && typeof res === "object" && "mrr" in res) {
        setData({
          mrr: Number(res.mrr) || 0,
          arr: Number(res.arr) || 0,
          activeTenants: Number(res.activeTenants) || 0,
          churnRate: Number(res.churnRate) || 0,
          totalRevenue: Number(res.totalRevenue) || 0,
          tierDistribution: Array.isArray(res.tierDistribution) ? res.tierDistribution : [],
        });
      } else {
        // Risposta non valida ma non è un errore (DB vuoto, ecc.)
        setData({
          mrr: 0, arr: 0, activeTenants: 0, churnRate: 0, totalRevenue: 0, tierDistribution: [],
        });
      }
    } catch (e: unknown) {
      console.error("Errore caricamento metrics:", e);
      setError(e instanceof Error ? e.message : "Errore sconosciuto nel caricamento delle metriche.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const fmtCurrency = (n: number) => 
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n ?? 0);

  // --- STATI DI RENDERING ---

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Calcolo metriche in corso...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-4 bg-card border border-dashed border-border/60 rounded-xl">
        <div className="h-16 w-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Impossibile caricare le metriche</h2>
        <p className="text-muted-foreground text-sm text-center max-w-md">{error}</p>
        <Button onClick={loadMetrics} variant="outline" className="mt-2 gap-2">
          <RefreshCw className="h-4 w-4" /> Riprova
        </Button>
      </div>
    );
  }

  // data è sempre definito qui (può avere valori a 0 ma mai null)
  const safeData = data!;

  return (
    <div className="dashboard-content animate-fadeIn">

      {/* ── Action bar ─────────────────────────────────────────────── */}
      <div className="flex justify-end mb-6">
        <Button variant="outline" size="sm" onClick={loadMetrics} className="rounded-xl shadow-sm gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Aggiorna
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="MRR (Monthly)" value={fmtCurrency(safeData.mrr)} icon={TrendingUp} colorVar="hsl(var(--chart-1))" />
        <KpiCard title="ARR (Annual)" value={fmtCurrency(safeData.arr)} icon={TrendingUp} colorVar="hsl(var(--chart-2))" />
        <KpiCard title="Tenant Attivi" value={String(safeData.activeTenants)} icon={Users} colorVar="hsl(var(--chart-3))" />
        <KpiCard title="Churn Rate" value={`${safeData.churnRate}%`} icon={Activity} colorVar="hsl(var(--chart-4))" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="glass-card shadow-lg p-6 flex flex-col items-center">
          <h3 className="font-bold text-lg mb-4 self-start">Distribuzione Piani (Tenants)</h3>
          {safeData.tierDistribution.length > 0 ? (
            <>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={safeData.tierDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {safeData.tierDistribution.map((entry, index) => (
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
                {safeData.tierDistribution.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-sm font-medium">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span>{entry.name}</span>
                    <span className="text-muted-foreground ml-1">({entry.value})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Nessun dato disponibile</p>
            </div>
          )}
        </Card>

        <Card className="glass-card shadow-lg p-6 flex flex-col justify-center items-center bg-primary/5 border-primary/20">
          <BarChart3 className="h-16 w-16 text-primary mb-4 opacity-50" />
          <h3 className="text-2xl font-black text-foreground mb-2">Ricavi dalle Fatture</h3>
          <p className="text-5xl font-black text-primary tabular-nums tracking-tighter drop-shadow-sm">
            {fmtCurrency(safeData.totalRevenue)}
          </p>
          <p className="text-muted-foreground mt-4 text-center max-w-sm">
            Somma di tutte le fatture in stato &quot;pagato&quot;. Questo valore riflette gli incassi reali.
          </p>
        </Card>
      </div>
    </div>
  );
}