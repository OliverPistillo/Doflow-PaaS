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

// Dati Mock
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
];

function KpiCard({ title, value, subValue }: { title: string; value: string; subValue?: string }) {
  return (
    <Card className="border-l-4 border-l-indigo-500 shadow-sm">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
              {title}
            </p>
            <h3 className="text-3xl font-black text-slate-900">{value}</h3>
            {subValue && <p className="text-sm text-slate-500 mt-1">{subValue}</p>}
          </div>
          <div className="p-2 bg-indigo-50 rounded-lg">
            <ArrowUpRight className="h-4 w-4 text-indigo-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SalesDashboardPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
          <span>Business Intelligence</span>
          <span className="text-slate-300">/</span>
          <span className="font-bold text-slate-900">Sales Dashboard</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Panoramica della pipeline</h1>
        <p className="text-slate-500 mt-1 text-sm font-medium">
          Dati aggregati di vendita e performance globale.
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Offerte in qualificazione" value="6" />
        <KpiCard title="Valore totale offerte" value="€6,800.00" />
        <KpiCard title="Tasso di vincita" value="100%" />
        <KpiCard title="Media offerta" value="€1,253.33" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Valore della pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} margin={{top: 10, right: 10, left: 0, bottom: 20}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{fontSize: 11, fill: "#64748B"}} interval={0} tickLine={false} axisLine={false} dy={10} />
                  <YAxis tickFormatter={(value) => `€${value/1000}k`} tick={{fontSize: 11, fill: "#64748B"}} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="value" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Distribuzione fase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}