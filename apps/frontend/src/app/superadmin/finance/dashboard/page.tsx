"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, TrendingUp, AlertCircle, Clock, Loader2, Filter, ChevronRight, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { apiFetch } from "@/lib/api";

// --- TIPI ---
interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
}

interface DashboardData {
  kpi: { revenue: number; pending: number; overdue: number; };
  trend: { month: string; revenue: number }[];
  statusDistribution: { name: string; value: number; color: string }[];
  topClients: { name: string; value: number }[];
  invoices: Invoice[];
}

// Helper formattazione valuta
const formatCurrency = (value: any): string => {
  if (value === undefined || value === null) return "€0,00";
  const val = Array.isArray(value) ? value[0] : value;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(num) 
    ? "€0,00" 
    : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num);
};

// --- COMPONENTE SHEET DRILL-DOWN (Dettaglio) ---
function DrillDownSheet({ 
    isOpen, 
    onClose, 
    title, 
    invoices 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    title: string; 
    invoices: Invoice[] 
}) {
    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-xl flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-indigo-600" />
                        Dettaglio: {title}
                    </SheetTitle>
                    <SheetDescription>
                        Elenco delle fatture che compongono questa voce.
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-3">
                    {invoices.length === 0 ? (
                        <p className="text-center text-slate-500 py-10">Nessuna fattura in questa categoria.</p>
                    ) : (
                        invoices.map(inv => (
                            <div key={inv.id} className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 bg-slate-50 rounded flex items-center justify-center text-slate-400">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-700 text-sm">{inv.clientName}</div>
                                        <div className="text-xs text-slate-500">
                                            #{inv.invoiceNumber} • {new Date(inv.issueDate).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono font-bold text-slate-900">
                                        €{Number(inv.amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                    </div>
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">{inv.status}</Badge>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}


// --- COMPONENTE KPI CARD INTERATTIVA ---
interface KpiProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  titleColorClass: string;
  hoverColorClass: string;
  onClick: () => void; // Aggiunto onClick
}

function FinanceKpiCard({ title, value, subtitle, icon: Icon, titleColorClass, hoverColorClass, onClick }: KpiProps) {
  return (
    <Card 
        className="shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-slate-200 group cursor-pointer relative overflow-hidden"
        onClick={onClick}
    >
      <div className={`absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity`}>
          <ArrowUpRight className={`h-5 w-5 ${titleColorClass}`} />
      </div>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${titleColorClass}`}>
              {title}
            </p>
            <div className="flex flex-col">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                {value}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">{subtitle}</p>
            </div>
          </div>
          <div className={`h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors duration-300 ${hoverColorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinanceDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Stati Filtro e Drill-Down
  const [yearFilter, setYearFilter] = useState("2026"); // Default anno corrente
  const [drillState, setDrillState] = useState<{ isOpen: boolean; type: 'revenue' | 'pending' | 'overdue' | null }>({
      isOpen: false,
      type: null
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<DashboardData>("/superadmin/finance/dashboard");
      setData(res);
    } catch (error) {
      console.error("Errore fetch dashboard finance", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- LOGICA DRILL DOWN ---
  const handleDrill = (type: 'revenue' | 'pending' | 'overdue') => {
      setDrillState({ isOpen: true, type });
  };

  const getDrillData = () => {
      if (!data || !drillState.type) return { title: "", list: [] };
      
      let filtered: Invoice[] = [];
      let title = "";

      switch (drillState.type) {
          case 'revenue':
              title = "Ricavi Totali (Fatture Pagate)";
              filtered = data.invoices.filter(i => i.status === 'paid');
              break;
          case 'pending':
              title = "In Attesa di Saldo";
              filtered = data.invoices.filter(i => i.status === 'pending');
              break;
          case 'overdue':
              title = "Fatture Scadute";
              filtered = data.invoices.filter(i => i.status === 'overdue');
              break;
      }
      return { title, list: filtered };
  };

  if (loading && !data) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-indigo-600 h-10 w-10" /></div>;
  }

  const stats = data || {
      kpi: { revenue: 0, pending: 0, overdue: 0 },
      trend: [],
      statusDistribution: [],
      topClients: [],
      invoices: []
  };

  const drillContent = getDrillData();

  return (
    <div className="space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-500 p-4 md:p-0">
      
      {/* Header Pulito con Filtri */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
            <span>Amministrazione</span>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-900 uppercase tracking-tighter">Finance</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Dashboard Finanziaria</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Panoramica delle performance finanziarie.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
             <div className="px-3 flex items-center gap-2 text-sm font-bold text-slate-600 border-r border-slate-100">
                 <Filter className="h-4 w-4 text-slate-400" />
                 Filtra:
             </div>
             <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-[120px] border-0 focus:ring-0 font-medium">
                    <SelectValue placeholder="Anno" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
             </Select>
        </div>
      </div>

      {/* KPI Row (Clickable) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FinanceKpiCard 
            title="Ricavi Totali" 
            value={formatCurrency(stats.kpi.revenue)} 
            subtitle="Fatturato incassato totale (Paid)"
            icon={TrendingUp}
            titleColorClass="text-emerald-600"
            hoverColorClass="group-hover:bg-emerald-50 group-hover:text-emerald-600"
            onClick={() => handleDrill('revenue')}
        />
        <FinanceKpiCard 
            title="In Attesa" 
            value={formatCurrency(stats.kpi.pending)} 
            subtitle="Fatture emesse non ancora saldate"
            icon={Clock}
            titleColorClass="text-amber-600"
            hoverColorClass="group-hover:bg-amber-50 group-hover:text-amber-600"
            onClick={() => handleDrill('pending')}
        />
        <FinanceKpiCard 
            title="Fatture Scadute" 
            value={stats.kpi.overdue.toString()} 
            subtitle="Richiede attenzione immediata"
            icon={AlertCircle}
            titleColorClass="text-rose-700"
            hoverColorClass="group-hover:bg-rose-50 group-hover:text-rose-700"
            onClick={() => handleDrill('overdue')}
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Invoice Status Pie */}
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30">
            <div className="flex justify-between items-center">
               <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                 Stato Pagamenti
               </CardTitle>
               <ArrowUpRight className="h-4 w-4 text-slate-300" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 relative">
            <div className="h-[300px] w-full">
               {stats.statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {stats.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
               ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">Nessun dato disponibile</div>
               )}
              {stats.statusDistribution.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="text-center">
                        <p className="text-2xl font-black text-slate-900">100%</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Totale</p>
                     </div>
                  </div>
              )}
            </div>
            <div className="flex justify-center gap-6 mt-4">
                {stats.statusDistribution.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-slate-600 uppercase tracking-tighter">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: s.color}} />
                        {s.name}
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Line Chart */}
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30">
            <div className="flex justify-between items-center">
               <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                 Trend Mensile Ricavi
               </CardTitle>
               <ArrowUpRight className="h-4 w-4 text-slate-300" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[340px] w-full">
              {stats.trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="month" 
                        tick={{fontSize: 10, fill: "#94a3b8", fontWeight: 600}} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        tickFormatter={(v) => `€${v}`} 
                        tick={{fontSize: 10, fill: "#94a3b8", fontWeight: 600}} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value: any) => [formatCurrency(value), "Ricavi"]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#0f172a" 
                        strokeWidth={4} 
                        dot={{r: 4, fill: "#0f172a", strokeWidth: 2, stroke: "#fff"}} 
                        activeDot={{r: 6, strokeWidth: 0}} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
              ) : (
                 <div className="h-full flex items-center justify-center text-slate-400 text-sm">Nessun trend disponibile</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Top Clients */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <CardHeader className="border-b border-slate-50 bg-slate-50/30">
          <div className="flex justify-between items-center">
             <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">
               Top Clienti per Volume d'Affari
             </CardTitle>
             <button className="text-[10px] font-black text-blue-600 hover:underline">VEDI TUTTI</button>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
            <div className="h-[300px] w-full">
              {stats.topClients.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.topClients} margin={{top: 0, right: 0, left: 0, bottom: 20}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        tick={{fontSize: 10, fill: "#64748B", fontWeight: 700}} 
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                      />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value: any) => [formatCurrency(value), "Fatturato"]}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#3b82f6" 
                        radius={[6, 6, 0, 0]} 
                        barSize={50}
                      >
                        {stats.topClients.map((entry, index) => (
                            <Cell 
                                key={`cell-${index}`} 
                                fill={index % 2 === 0 ? '#0f172a' : '#3b82f6'} 
                                fillOpacity={0.9}
                            />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              ) : (
                 <div className="h-full flex items-center justify-center text-slate-400 text-sm">Nessun dato clienti</div>
              )}
            </div>
        </CardContent>
      </Card>

      {/* COMPONENTE DRILL DOWN (MODALE) */}
      <DrillDownSheet 
        isOpen={drillState.isOpen} 
        onClose={() => setDrillState({ ...drillState, isOpen: false })} 
        title={drillContent.title}
        invoices={drillContent.list}
      />

    </div>
  );
}