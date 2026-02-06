"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";
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

// --- Dati Mock ---
const pipelineData = [
  { name: "Lead qualificato", value: 45000 },
  { name: "Preventivo inviato", value: 68000 },
  { name: "Negoziazione", value: 42000 },
  { name: "Chiuso vinto", value: 28000 },
];

const pieData = [
  { name: "Lead qualificato", value: 20, color: "#BFDBFE" },
  { name: "Preventivo inviato", value: 20, color: "#93C5FD" },
  { name: "Negoziazione", value: 40, color: "#FDE68A" },
  { name: "Chiuso vinto", value: 20, color: "#BBF7D0" },
];

const offersData = [
  { name: "App Mobile", value: 12000 },
  { name: "Campagna Mkt", value: 15000 },
  { name: "Consulenza", value: 5000 },
  { name: "Contratto Beta", value: 22000 },
  { name: "Audit Security", value: 4500 },
  { name: "Integrazione CRM", value: 9000 },
  { name: "Upgrade HW", value: 6000 },
  { name: "Cloud Mig.", value: 18000 },
  { name: "SaaS Sub", value: 11000 },
  { name: "Pilot Project", value: 24000 },
  { name: "Formazione", value: 8000 },
  { name: "Redesign Sito", value: 13000 },
  { name: "Supporto Tec", value: 15000 },
  { name: "Data Analysis", value: 9000 },
  { name: "Expansion", value: 12000 },
];

// --- Componente KPI Card Neutro (Shadcn Style) ---
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
          {/* Il colore appare solo qui, su hover del genitore o del bottone */}
          <div className={`h-9 w-9 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:bg-slate-100 transition-colors duration-300 cursor-pointer ${hoverColorClass}`}>
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SalesDashboardPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 p-2 md:p-0 max-w-[1800px] mx-auto">
      
      {/* Header */}
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

      {/* KPI Row (Neutri) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Offerte in qualificazione" 
          value="6" 
          hoverColorClass="hover:bg-blue-100 hover:text-blue-600"
        />
        <KpiCard 
          title="Valore totale offerte" 
          value="€6,800.00" 
          hoverColorClass="hover:bg-indigo-100 hover:text-indigo-600"
        />
        <KpiCard 
          title="Tasso di vincita" 
          value="100%" 
          hoverColorClass="hover:bg-emerald-100 hover:text-emerald-600"
        />
        <KpiCard 
          title="Media offerta" 
          value="€1,253.33" 
          hoverColorClass="hover:bg-violet-100 hover:text-violet-600"
        />
      </div>

      {/* Alert Row */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">
            Si prevede che le offerte si chiuderanno questo mese
          </p>
          <p className="text-3xl font-black text-indigo-900 leading-none">1</p>
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
                <BarChart data={pipelineData} margin={{top: 10, right: 10, left: 0, bottom: 20}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{fontSize: 11, fill: "#64748B"}} 
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    tickFormatter={(value) => `€${value.toLocaleString()}`} 
                    tick={{fontSize: 11, fill: "#64748B"}} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
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
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* Legend */}
              <div className="w-full md:w-1/3 flex flex-col justify-center gap-4 p-4 text-right">
                 <p className="text-xs text-slate-400 font-medium mb-1">Fase</p>
                 {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-end gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-slate-600 font-medium">{d.name}</span>
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
                <BarChart data={offersData} margin={{top: 20, right: 30, left: 0, bottom: 5}}>
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