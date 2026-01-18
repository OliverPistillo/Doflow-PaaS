'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// --- TIPI ---
type StatsResponse = {
  kpi: {
    new_lead: number;
    no_answer: number;
    booked: number;
    waiting: number;
    closed_won: number;
    closed_lost: number;
    fatturato_eur: number;
  };
  monthly: { month: number; value: number }[];
  treatments: { name: string; value: number }[];
};

const MONTH_NAMES = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
];

// Colori per il grafico a torta
const PIE_COLORS = ['#A78BFA', '#F472B6', '#FCD34D', '#60A5FA', '#34D399'];

export default function FedericaDashboardPage() {
  const [data, setData] = React.useState<StatsResponse | null>(null);
  const [year, setYear] = React.useState<string>(String(new Date().getFullYear()));
  const [loading, setLoading] = React.useState(false);

  // Caricamento Dati
  const loadStats = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<StatsResponse>(`/appuntamenti/stats?year=${year}`);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year]);

  React.useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // Se i dati non sono ancora pronti
  if (!data && loading) return <div className="p-8 text-muted-foreground">Caricamento dashboard...</div>;
  if (!data) return <div className="p-8 text-red-500">Errore caricamento dati.</div>;

  // Preparazione dati grafici
  const chartMonthly = data.monthly.map(m => ({
    name: MONTH_NAMES[m.month - 1],
    Fatturato: m.value
  }));

  // Formattatore valuta
  const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Panoramica prestazioni e obiettivi.</p>
        </div>
        
        {/* Selettore Anno */}
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Anno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadStats} disabled={loading}>
            ↻
          </Button>
        </div>
      </div>

      {/* --- SEZIONE KPI --- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard title="Nuovi Lead" value={data.kpi.new_lead} color="border-l-4 border-l-gray-400" />
        <KpiCard title="Nessuna Risposta" value={data.kpi.no_answer} color="border-l-4 border-l-orange-300 bg-orange-50/30" />
        <KpiCard title="Appuntamenti" value={data.kpi.booked} color="border-l-4 border-l-blue-400 bg-blue-50/30" />
        <KpiCard title="In Attesa" value={data.kpi.waiting} color="border-l-4 border-l-yellow-400 bg-yellow-50/30" />
        <KpiCard title="Eseguiti (Won)" value={data.kpi.closed_won} color="border-l-4 border-l-green-500 bg-green-50/30" />
        <KpiCard title="Persi (Lost)" value={data.kpi.closed_lost} color="border-l-4 border-l-red-400 bg-red-50/30" />
      </div>

      {/* --- SEZIONE FATTURATO --- */}
      <Card className="border-l-4 border-l-emerald-500 overflow-hidden">
        <CardHeader className="bg-emerald-50/20 pb-2">
          <CardTitle className="text-sm font-medium text-emerald-800">Fatturato Totale {year}</CardTitle>
          <div className="text-4xl font-bold text-emerald-600">
            {eur.format(data.kpi.fatturato_eur)}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartMonthly}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `€${value}`} 
                />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  // FIX TYPE ERROR: 'value: any' accetta undefined che Recharts può passare
                  formatter={(value: any) => [eur.format(Number(value || 0)), 'Fatturato']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar 
                  dataKey="Fatturato" 
                  fill="#10B981" 
                  radius={[4, 4, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* --- SEZIONE TRATTAMENTI --- */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Grafico a Torta */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuzione Trattamenti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex items-center justify-center">
              {data.treatments.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.treatments}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.treatments.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground">Nessun dato trattamenti.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista Top 5 */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Trattamenti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.treatments.map((t, idx) => (
                <div key={t.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} 
                    />
                    <span className="font-medium text-sm truncate max-w-[200px]" title={t.name}>
                      {t.name}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-muted-foreground">
                    {t.value} <span className="font-normal text-xs">eseguiti</span>
                  </div>
                </div>
              ))}
              {data.treatments.length === 0 && (
                <div className="text-sm text-muted-foreground">Nessun dato.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Componente helper per le card KPI
function KpiCard({ title, value, color }: { title: string; value: number; color?: string }) {
  return (
    <Card className={`shadow-sm ${color || ''}`}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}