"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { DrillDownSheet, CardContextType } from "./components/DrillDownSheet";
import { GlobalFilterBar, DashboardFilters } from "./components/GlobalFilterBar";
import { STAGE_CONFIG, formatCurrency } from "./utils";
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

// Colori per il grafico a torta
const PIE_COLORS = ["#BFDBFE", "#93C5FD", "#FDE68A", "#BBF7D0", "#cbd5e1"];

// --- Componente KPI Card ---
function KpiCard({ 
  title, 
  value, 
  colorClass, 
  onClick 
}: { 
  title: string; 
  value: string; 
  colorClass: string; 
  onClick: () => void 
}) {
  return (
    <Card 
      className="shadow-sm hover:shadow-md transition-shadow cursor-pointer group" 
      onClick={onClick}
    >
      <CardContent className="p-6 flex justify-between items-start">
        <div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-black text-slate-900 mt-1">{value}</h3>
        </div>
        <div className={`h-9 w-9 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:${colorClass} group-hover:text-white transition-colors duration-300`}>
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

  // Caricamento Dati KPI (Influenzato dai filtri globali)
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

  // Ricarica quando cambiano i filtri
  useEffect(() => {
    loadData();
  }, [filters]);

  if (loading && !data) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!data) return null;

  // Calcolo mese corrente per alert row
  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6 p-2 md:p-0 max-w-[1800px] mx-auto animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
            <span>Business Intelligence</span>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-900">Sales Dashboard</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Quadro generale vendite</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Monitoraggio opportunità e performance.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="mr-2 h-3 w-3"/> Aggiorna Dati
        </Button>
      </div>

      {/* 1. BARRA FILTRI GLOBALE */}
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} />

      {/* 2. KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Offerte in qualificazione" 
          value={String(data.kpi.leadsCount)} 
          colorClass="bg-blue-600"
          onClick={() => setActiveCard('QUALIFIED_LEADS')}
        />
        <KpiCard 
          title="Valore totale (Filtrato)" 
          value={formatCurrency(data.kpi.totalValue)} 
          colorClass="bg-indigo-600"
          onClick={() => setActiveCard('TOTAL_VALUE')}
        />
        <KpiCard 
          title="Tasso di vincita" 
          value={`${data.kpi.winRate}%`} 
          colorClass="bg-emerald-600"
          onClick={() => setActiveCard('WIN_RATE')}
        />
        <KpiCard 
          title="Media offerta" 
          value={formatCurrency(data.kpi.avgDealValue)} 
          colorClass="bg-violet-600"
          onClick={() => setActiveCard('AVG_VALUE')}
        />
      </div>

      {/* Alert Row (Chiusura Mese) */}
      <div 
        className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex justify-between items-center cursor-pointer hover:bg-indigo-100 transition-colors shadow-sm"
        onClick={() => setActiveCard('CLOSING_THIS_MONTH')}
      >
        <div>
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">
            In chiusura (Mese corrente o selezionato)
          </p>
          <p className="text-3xl font-black text-indigo-900 leading-none">
            {data.kpi.dealsClosingThisMonth}
          </p>
        </div>
        <div className="h-10 w-10 bg-white border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-500">
           <ArrowUpRight className="h-5 w-5" />
        </div>
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pipeline Bar Chart */}
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Valore pipeline per fase
                </CardTitle>
                <div className="h-8 w-8 bg-slate-50 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer transition-colors">
                   <ArrowUpRight className="h-4 w-4" />
                 </div>
              </div>
              <p className="text-xs text-slate-400 font-medium">Somma del valore delle offerte raggruppate per stato.</p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.pipeline}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis 
                            dataKey="stage" 
                            tick={{fontSize: 10, fill: "#64748B"}} 
                            interval={0} 
                            tickLine={false} 
                            axisLine={false} 
                            dy={10}
                          />
                          <YAxis 
                            tick={{fontSize: 10, fill: "#64748B"}} 
                            tickFormatter={(v) => `€${v/1000}k`} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <Tooltip
                            cursor={{ fill: '#F1F5F9' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            // FIX: Cambia il tipo di 'val' in 'any' e usa Number() per sicurezza
                            formatter={(val: any) => [formatCurrency(Number(val) || 0), 'Valore']}
                          />
                          <Bar dataKey="value" fill="#6366f1" radius={[4,4,0,0]} barSize={50} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
            </CardContent>
        </Card>
        
        {/* Pie Chart */}
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Distribuzione offerte (Quantità)
                </CardTitle>
                <div className="h-8 w-8 bg-slate-50 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer transition-colors">
                   <ArrowUpRight className="h-4 w-4" />
                 </div>
              </div>
              <p className="text-xs text-slate-400 font-medium">Numero di offerte presenti in ogni fase.</p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] mt-2 flex flex-col md:flex-row items-center">
                  <div className="h-full w-full md:w-2/3">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                              data={data.pipeline} 
                              dataKey="count" 
                              innerRadius={60} 
                              outerRadius={100} 
                              paddingAngle={2}
                              stroke="none"
                            >
                                {data.pipeline.map((entry, index) => {
                                    const color = STAGE_CONFIG[entry.stage]?.color || '#cbd5e1';
                                    return <Cell key={`cell-${index}`} fill={color} />;
                                })}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Legenda Custom */}
                  <div className="w-full md:w-1/3 flex flex-col justify-center gap-3 p-4 text-right">
                      {data.pipeline.map((d, i) => {
                        const color = STAGE_CONFIG[d.stage]?.color || '#cbd5e1';
                        return (
                          <div key={i} className="flex items-center justify-end gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs text-slate-600 font-medium">{d.stage}</span>
                            <span className="text-xs font-bold text-slate-900">({d.count})</span>
                          </div>
                        );
                      })}
                  </div>
              </div>
            </CardContent>
        </Card>
      </div>

      {/* 3. Deals Row (Bottom) - Top Deals Chart */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
             <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
               Le migliori offerte per valore
             </CardTitle>
             <div className="h-8 w-8 bg-slate-50 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer transition-colors">
                 <ArrowUpRight className="h-4 w-4" />
             </div>
          </div>
          <p className="text-xs text-slate-400 font-medium">Top 10 offerte ordinate per valore economico.</p>
        </CardHeader>
        <CardContent>
           <div className="h-[250px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topDeals} margin={{top: 20, right: 30, left: 0, bottom: 5}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{fontSize: 10, fill: "#94a3b8"}} 
                    interval={0} 
                    angle={-45} 
                    textAnchor="end" 
                    height={80} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    cursor={{fill: '#F8FAFC'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                    // FIX APPLICATO QUI:
                    formatter={(val: any) => [formatCurrency(Number(val) || 0), 'Valore']}
                  />
                  <Bar dataKey="value" fill="#5a7bd4" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </CardContent>
      </Card>

      {/* 4. DRILL DOWN SHEET (Intelligente) */}
      <DrillDownSheet 
        cardType={activeCard} 
        globalFilters={filters}
        onClose={() => setActiveCard(null)} 
      />

    </div>
  );
}