"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
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

// --- TIPI ---
type DashboardData = {
  kpi: {
    leadsCount: number;
    totalValue: number;
    winRate: number;
    avgDealValue: number;
    dealsClosingThisMonth: number; // <--- NUOVO CAMPO
  };
  pipeline: {
    stage: string;
    value: number;
    count: number;
  }[];
  topDeals: {
    name: string;
    client: string;
    value: number;
    stage: string;
  }[];
};

// --- COLORI ---
const PIE_COLORS = ["#BFDBFE", "#93C5FD", "#FDE68A", "#BBF7D0"];

// --- Componente KPI Card ---
function KpiCard({ title, value, hoverColorClass }: { title: string; value: string; hoverColorClass: string }) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {value}
            </h3>
          </div>
          <div className={`h-9 w-9 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:bg-slate-100 transition-colors duration-300 cursor-pointer ${hoverColorClass}`}>
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SalesDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiFetch<DashboardData>("/superadmin/dashboard/stats");
      setData(res);
    } catch (e) {
      console.error("Errore fetch dashboard:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-500 font-medium">Caricamento dashboard in corso...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-slate-500">Impossibile caricare i dati della dashboard.</p>
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Riprova
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 p-2 md:p-0 max-w-[1800px] mx-auto">
      
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
            <span>Business Intelligence</span>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-900">Sales Dashboard</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Panoramica della pipeline di vendita</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">
            Pipeline: offerte per fase, tasso di vincita, chiusure del mese e operazioni principali.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={loadData} className="text-slate-400 hover:text-indigo-600">
            <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Offerte in qualificazione" 
          value={String(data.kpi.leadsCount)} 
          hoverColorClass="hover:bg-blue-100 hover:text-blue-600"
        />
        <KpiCard 
          title="Valore totale offerte" 
          value={`€${data.kpi.totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          hoverColorClass="hover:bg-indigo-100 hover:text-indigo-600"
        />
        <KpiCard 
          title="Tasso di vincita" 
          value={`${data.kpi.winRate}%`} 
          hoverColorClass="hover:bg-emerald-100 hover:text-emerald-600"
        />
        <KpiCard 
          title="Media offerta" 
          value={`€${data.kpi.avgDealValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          hoverColorClass="hover:bg-violet-100 hover:text-violet-600"
        />
      </div>

      {/* Alert Row (DINAMICO) */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">
            Si prevede che le offerte si chiuderanno questo mese
          </p>
          <p className="text-3xl font-black text-indigo-900 leading-none">
            {data.kpi.dealsClosingThisMonth} {/* <--- ORA È DINAMICO */}
          </p>
        </div>
        <div className="h-9 w-9 bg-white border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer">
           <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Bar Chart Pipeline */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
               <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                 Valore della pipeline per fase
               </CardTitle>
               <div className="h-8 w-8 bg-slate-50 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer transition-colors">
                 <ArrowUpRight className="h-4 w-4" />
               </div>
            </div>
            <p className="text-xs text-slate-400 font-medium">Valore totale dell'accordo riepilogato per fase di vendita</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.pipeline} margin={{top: 10, right: 10, left: 0, bottom: 20}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="stage" 
                    tick={{fontSize: 11, fill: "#64748B"}} 
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    tickFormatter={(value) => `€${value/1000}k`} 
                    tick={{fontSize: 11, fill: "#64748B"}} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                    formatter={(value: number | undefined) => [`€${(value || 0).toLocaleString()}`, 'Valore']}
                  />
                  <Bar dataKey="value" fill="#5a7bd4" radius={[4, 4, 0, 0]} barSize={80} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart Distribution */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
               <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                 Distribuzione della fase dell'accordo
               </CardTitle>
               <div className="h-8 w-8 bg-slate-50 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer transition-colors">
                 <ArrowUpRight className="h-4 w-4" />
               </div>
            </div>
            <p className="text-xs text-slate-400 font-medium">Numero di accordi raggruppati in base alla loro fase attuale</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center h-[300px]">
              <div className="h-full w-full md:w-2/3 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.pipeline}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                      stroke="none"
                    >
                      {data.pipeline.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* Legend */}
              <div className="w-full md:w-1/3 flex flex-col justify-center gap-4 p-4 text-right">
                 <p className="text-xs text-slate-400 font-medium mb-1">Fase</p>
                 {data.pipeline.map((d, i) => (
                    <div key={i} className="flex items-center justify-end gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-slate-600 font-medium">{d.stage}</span>
                    </div>
                 ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deals Row (Bottom) */}
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
          <p className="text-xs text-slate-400 font-medium">Mostra le offerte con i valori più alti per evidenziare le opportunità più significative.</p>
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
                    formatter={(value: number | undefined) => [`€${(value || 0).toLocaleString()}`, 'Valore']}
                  />
                  <Bar dataKey="value" fill="#5a7bd4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </CardContent>
      </Card>

    </div>
  );
}