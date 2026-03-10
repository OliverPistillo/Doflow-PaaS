"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
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

// --- Componente KPI Card ---
function KpiCard({ 
  title, 
  value, 
  colorVar, 
  onClick 
}: { 
  title: string; 
  value: string; 
  colorVar: string; 
  onClick: () => void 
}) {
  return (
    <Card 
      className="glass-card transition-all duration-300 cursor-pointer group hover:-translate-y-1 hover:shadow-2xl overflow-hidden relative" 
      onClick={onClick}
    >
      {/* Glow Effect Dinamico */}
      <div 
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500"
        style={{ backgroundColor: colorVar }}
      />
      
      <CardContent className="p-6 flex justify-between items-start relative z-10">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black text-foreground mt-2 tracking-tight">{value}</h3>
        </div>
        <div 
          className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/50 transition-all duration-300 group-hover:scale-110 shadow-sm"
          style={{ color: colorVar, border: `1px solid color-mix(in srgb, ${colorVar} 20%, transparent)` }}
        >
          <ArrowUpRight className="h-5 w-5" />
        </div>
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

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  if (loading && !data) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Sincronizzazione metriche globali...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1800px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-2 uppercase tracking-widest">
            <span>Business Intelligence</span>
            <span className="text-border">•</span>
            <span className="text-primary">Sales Ops</span>
          </div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">Quadro Generale</h1>
          <p className="text-muted-foreground mt-2 text-sm font-medium">Monitoraggio in tempo reale delle opportunità multi-tenant.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="rounded-xl shadow-sm hover:border-primary/50 transition-colors">
          <RefreshCw className="mr-2 h-4 w-4"/> Aggiorna Dati
        </Button>
      </div>

      {/* 1. BARRA FILTRI GLOBALE */}
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} />

      {/* 2. KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Offerte in qualifica" 
          value={String(data.kpi.leadsCount)} 
          colorVar="hsl(var(--chart-1))"
          onClick={() => setActiveCard('QUALIFIED_LEADS')}
        />
        <KpiCard 
          title="Valore filtrato" 
          value={formatCurrency(data.kpi.totalValue)} 
          colorVar="hsl(var(--chart-2))"
          onClick={() => setActiveCard('TOTAL_VALUE')}
        />
        <KpiCard 
          title="Tasso di vincita" 
          value={`${data.kpi.winRate}%`} 
          colorVar="hsl(var(--chart-3))"
          onClick={() => setActiveCard('WIN_RATE')}
        />
        <KpiCard 
          title="Media per deal" 
          value={formatCurrency(data.kpi.avgDealValue)} 
          colorVar="hsl(var(--chart-4))"
          onClick={() => setActiveCard('AVG_VALUE')}
        />
      </div>

      {/* Alert Row (Chiusura Mese) */}
      <div 
        className="relative overflow-hidden border border-primary/20 rounded-2xl p-6 flex justify-between items-center cursor-pointer hover:shadow-lg transition-all shadow-sm group"
        onClick={() => setActiveCard('CLOSING_THIS_MONTH')}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent z-0" />
        <div className="relative z-10">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
            In chiusura (Mese corrente o selezionato)
          </p>
          <p className="text-4xl font-black text-foreground tracking-tighter">
            {data.kpi.dealsClosingThisMonth} <span className="text-lg font-medium text-muted-foreground tracking-normal">deals critici</span>
          </p>
        </div>
        <div className="relative z-10 h-12 w-12 bg-background border border-primary/30 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
           <ArrowUpRight className="h-6 w-6" />
        </div>
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pipeline Bar Chart */}
        <Card className="glass-card">
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
                            tick={{fontSize: 11, fill: "hsl(var(--muted-foreground))"}} 
                            interval={0} 
                            tickLine={false} 
                            axisLine={false} 
                            dy={10}
                          />
                          <YAxis 
                            tick={{fontSize: 11, fill: "hsl(var(--muted-foreground))"}} 
                            tickFormatter={(v) => `€${v/1000}k`} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <Tooltip
                            cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                            formatter={(val: any) => [formatCurrency(Number(val) || 0), 'Valore']}
                          />
                          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6,6,0,0]} barSize={45} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
            </CardContent>
        </Card>
        
        {/* Pie Chart */}
        <Card className="glass-card">
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
                                {data.pipeline.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
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

      {/* 3. Top Deals Chart */}
      <Card className="glass-card">
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
                <BarChart data={data.topDeals} margin={{top: 20, right: 30, left: 0, bottom: 5}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    tick={{fontSize: 11, fill: "hsl(var(--muted-foreground))"}} 
                    interval={0} 
                    angle={-30} 
                    textAnchor="end" 
                    height={70} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                    contentStyle={{backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))'}}
                    formatter={(val: any) => [formatCurrency(Number(val) || 0), 'Valore']}
                  />
                  <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </CardContent>
      </Card>

      {/* 4. DRILL DOWN SHEET */}
      <DrillDownSheet 
        cardType={activeCard} 
        globalFilters={filters}
        onClose={() => setActiveCard(null)} 
      />

    </div>
  );
}