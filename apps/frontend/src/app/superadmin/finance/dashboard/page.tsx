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
  { name: "Paid", value: 40, color: "#3B82F6" }, // Blue
  { name: "Overdue", value: 20, color: "#FDE047" }, // Yellow
  { name: "Unpaid", value: 40, color: "#EF4444" }, // Red
];

function FinanceKpiCard({ title, value, colorClass }: { title: string; value: string; colorClass: string }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${colorClass}`}>
              {title}
            </p>
            <h3 className={`text-3xl font-black ${colorClass.replace("text-", "text-slate-900 ")}`}>{value}</h3>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg">
            <ArrowUpRight className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinanceDashboardPage() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      <div>
        <h1 className="text-3xl font-black text-slate-900">Panoramica finanziaria</h1>
        <p className="text-slate-500 mt-1 text-sm font-medium">Metriche principali su ricavi, fatture e clienti top.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FinanceKpiCard title="Ricavi totali (fatture pagate)" value="€7,656.15" colorClass="text-green-600" />
        <FinanceKpiCard title="Pagamenti in sospeso" value="€8,210.75" colorClass="text-red-600" />
        <FinanceKpiCard title="Fatture scadute" value="3" colorClass="text-rose-600" />
        {/* Aggiunto per bilanciare griglia o rimuovere */}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Distribuzione stato pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={invoiceStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {invoiceStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
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
          <CardHeader>
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Tendenze mensili dei ricavi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{fontSize: 12}} tickLine={false} axisLine={false} dy={10} />
                  <YAxis tickFormatter={(v) => `€${v}`} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Clients */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-xs font-bold text-slate-500 uppercase">I migliori clienti per fatturato</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClients} margin={{top: 20, right: 30, left: 0, bottom: 5}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                  <Bar dataKey="value" fill="#5878a1" radius={[4, 4, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}