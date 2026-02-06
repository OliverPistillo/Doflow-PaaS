"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

// Dati Mock
const revenueTrend = [
  { month: "Jan", revenue: 4000 },
  { month: "Feb", revenue: 3000 },
  { month: "Mar", revenue: 2000 },
  { month: "Apr", revenue: 2780 },
  { month: "May", revenue: 1890 },
  { month: "Jun", revenue: 2390 },
  { month: "Jul", revenue: 3490 },
];

const topClients = [
  { name: "Acme Corp", value: 12000 },
  { name: "Maple & Co", value: 9000 },
  { name: "Petal Pushers", value: 5000 },
  { name: "Silverline", value: 15000 },
  { name: "Sunrise Health", value: 8000 },
  { name: "Urban Eats", value: 18000 },
];

const invoiceStatus = [
  { name: "Paid", value: 40, color: "#EC4899" }, // Pink
  { name: "Overdue", value: 20, color: "#FCD34D" }, // Yellow
  { name: "Unpaid", value: 40, color: "#60A5FA" }, // Blue
];

// --- Componente KPI Card Corretto (Design Classico con Colori Diversi) ---
function FinanceKpiCard({ 
  title, 
  value, 
  borderClass, 
  textClass, 
  iconBgClass, 
  iconColorClass 
}: { 
  title: string; 
  value: string; 
  borderClass: string;
  textClass: string;
  iconBgClass: string;
  iconColorClass: string;
}) {
  return (
    <Card className={`border-l-4 shadow-sm ${borderClass}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${textClass}`}>
              {title}
            </p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tight">
              {value}
            </h3>
          </div>
          <div className={`p-2 rounded-lg ${iconBgClass}`}>
            <ArrowUpRight className={`h-5 w-5 ${iconColorClass}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinanceDashboardPage() {
  return (
    <div className="space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-500 p-2 md:p-0">
      
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
          <span>Fatturazione e pagamenti</span>
          <span className="text-slate-300">/</span>
          <span className="font-bold text-slate-900">Dashboard finanziario</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Panoramica finanziaria</h1>
        <p className="text-slate-500 mt-1 text-sm font-medium">Metriche principali su ricavi, fatture e clienti top.</p>
      </div>

      {/* KPI Row (Colori specifici) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Ricavi (Verde) */}
        <FinanceKpiCard 
            title="Ricavi totali (fatture pagate)" 
            value="€7,656.15" 
            borderClass="border-emerald-500"
            textClass="text-emerald-600"
            iconBgClass="bg-emerald-50"
            iconColorClass="text-emerald-600"
        />
        {/* Pagamenti Sospesi (Rosso Scuro) */}
        <FinanceKpiCard 
            title="Pagamenti in sospeso" 
            value="€8,210.75" 
            borderClass="border-red-700"
            textClass="text-red-700"
            iconBgClass="bg-red-50"
            iconColorClass="text-red-700"
        />
        {/* Fatture Scadute (Rosso Acceso) */}
        <FinanceKpiCard 
            title="Fatture scadute" 
            value="3" 
            borderClass="border-rose-500"
            textClass="text-rose-600"
            iconBgClass="bg-rose-50"
            iconColorClass="text-rose-600"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
               <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                 Distribuzione dello stato di pagamento
               </CardTitle>
               <div className="h-8 w-8 bg-slate-50 rounded flex items-center justify-center text-slate-400">
                 <ArrowUpRight className="h-4 w-4" />
               </div>
            </div>
            <p className="text-xs text-slate-400 font-medium">Conteggio delle fatture in base al loro stato di pagamento</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex justify-center mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={invoiceStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={0} // Pie piena
                    outerRadius={100}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="white"
                    strokeWidth={2}
                  >
                    {invoiceStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 absolute right-10 top-1/2 transform -translate-y-1/2">
                <p className="text-xs text-slate-400 font-bold mb-1 uppercase">Status</p>
                {invoiceStatus.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: s.color}} />
                        {s.name}
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
               <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                 Tendenze mensili dei ricavi
               </CardTitle>
               <div className="h-8 w-8 bg-slate-50 rounded flex items-center justify-center text-slate-400">
                 <ArrowUpRight className="h-4 w-4" />
               </div>
            </div>
            <p className="text-xs text-slate-400 font-medium">Importo totale della fattura pagata per mese di data di emissione.</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{fontSize: 12, fill: "#94a3b8"}} tickLine={false} axisLine={false} dy={10} />
                  <YAxis tickFormatter={(v) => `€${v.toLocaleString()}`} tick={{fontSize: 12, fill: "#94a3b8"}} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} dot={{r: 4, fill: "#3B82F6"}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Clients */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
             <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
               I migliori clienti per fatturato
             </CardTitle>
             <div className="h-8 w-8 bg-slate-50 rounded flex items-center justify-center text-slate-400">
                 <ArrowUpRight className="h-4 w-4" />
             </div>
          </div>
          <p className="text-xs text-slate-400 font-medium">Importo totale della fattura pagata raggruppato per cliente</p>
        </CardHeader>
        <CardContent>
           <div className="h-[250px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClients} margin={{top: 20, right: 30, left: 0, bottom: 5}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{fontSize: 11, fill: "#64748B"}} 
                    interval={0} 
                    angle={-45} 
                    textAnchor="end" 
                    height={60} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <Tooltip cursor={{fill: '#F8FAFC'}} />
                  <Bar dataKey="value" fill="#5a7bd4" radius={[4, 4, 0, 0]} barSize={60} />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}