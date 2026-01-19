'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Users, 
  PhoneMissed, 
  CalendarCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  DollarSign,
  Activity
} from 'lucide-react';
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
  AreaChart,
  Area
} from 'recharts';
import { cn } from '@/lib/utils';

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

// Palette Moderna
const PIE_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981'];
const CHART_COLOR = '#10b981'; // Emerald per i soldi

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

  // Loading / Error states minimali
  if (!data && loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Caricamento analytics...</div>;
  if (!data) return <div className="flex h-screen items-center justify-center text-red-500">Errore caricamento dati.</div>;

  // Preparazione dati grafici
  const chartMonthly = data.monthly.map(m => ({
    name: MONTH_NAMES[m.month - 1],
    Fatturato: m.value
  }));

  const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-transparent space-y-8 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Panoramica delle performance di business per l'anno <strong>{year}</strong>.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[120px] bg-background">
              <SelectValue placeholder="Anno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadStats} disabled={loading} className="shrink-0">
            <Activity className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* --- SEZIONE KPI (Top Row) --- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard 
          title="Fatturato Totale" 
          value={eur.format(data.kpi.fatturato_eur)} 
          icon={DollarSign} 
          trend="high"
          trendColor="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
        />
        <KpiCard 
          title="Nuovi Clienti" 
          value={data.kpi.new_lead} 
          icon={Users}
          trendColor="text-blue-600 bg-blue-50 dark:bg-blue-950/30"
        />
        <KpiCard 
          title="Appuntamenti" 
          value={data.kpi.booked + data.kpi.closed_won} 
          icon={CalendarCheck}
          trendColor="text-violet-600 bg-violet-50 dark:bg-violet-950/30"
        />
        <KpiCard 
          title="Tasso Conversione" 
          value={`${data.kpi.closed_won > 0 ? Math.round((data.kpi.closed_won / (data.kpi.booked + data.kpi.closed_won + data.kpi.closed_lost)) * 100) : 0}%`}
          icon={TrendingUp}
          trendColor="text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30"
        />
      </div>

      {/* --- MAIN GRID (Bento) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">
        
        {/* Main Chart: Fatturato */}
        <div className="lg:col-span-2 rounded-2xl border bg-card text-card-foreground shadow-sm p-6 relative">
           <div className="mb-6 flex items-center justify-between">
             <div>
                <h3 className="font-semibold text-lg">Andamento Fatturato</h3>
                <p className="text-sm text-muted-foreground">Distribuzione mensile delle entrate.</p>
             </div>
             <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Yearly</Badge>
           </div>
           
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartMonthly}>
                 <defs>
                   <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor={CHART_COLOR} stopOpacity={0.3}/>
                     <stop offset="95%" stopColor={CHART_COLOR} stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                 <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} />
                 <Tooltip 
                   cursor={{ stroke: '#e2e8f0' }}
                   content={({ active, payload }) => {
                     if (active && payload && payload.length) {
                       return (
                         <div className="rounded-lg border bg-background p-2 shadow-xl text-xs font-medium">
                           <div className="text-muted-foreground mb-1">{payload[0].payload.name}</div>
                           <div className="text-emerald-600 text-base font-bold">
                              {eur.format(Number(payload[0].value))}
                           </div>
                         </div>
                       )
                     }
                     return null;
                   }}
                 />
                 <Area 
                   type="monotone" 
                   dataKey="Fatturato" 
                   stroke={CHART_COLOR} 
                   strokeWidth={3}
                   fillOpacity={1} 
                   fill="url(#colorRevenue)" 
                 />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Funnel Stats (Vertical Stack) */}
        <div className="space-y-6">
           <div className="rounded-2xl border bg-card p-6 h-full flex flex-col">
              <h3 className="font-semibold text-lg mb-1">Stato Appuntamenti</h3>
              <p className="text-sm text-muted-foreground mb-6">Pipeline operativa corrente.</p>
              
              <div className="space-y-4 flex-1">
                 <FunnelRow label="Eseguiti (Won)" value={data.kpi.closed_won} total={100} color="bg-emerald-500" icon={CheckCircle2} />
                 <FunnelRow label="Prenotati (Booked)" value={data.kpi.booked} total={100} color="bg-blue-500" icon={CalendarCheck} />
                 <FunnelRow label="In Attesa (Waiting)" value={data.kpi.waiting} total={100} color="bg-amber-400" icon={Clock} />
                 <FunnelRow label="No Risposta" value={data.kpi.no_answer} total={100} color="bg-orange-400" icon={PhoneMissed} />
                 <FunnelRow label="Persi (Lost)" value={data.kpi.closed_lost} total={100} color="bg-red-400" icon={XCircle} />
              </div>
           </div>
        </div>
      </div>

      {/* --- BOTTOM ROW: PRODUCTS & INSIGHTS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Pie Chart: Trattamenti */}
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Distribuzione Servizi</CardTitle>
            <CardDescription>Quali categorie di servizi sono più richieste?</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
             <div className="h-[350px] w-full border rounded-2xl bg-card p-4 flex items-center justify-center relative">
                {data.treatments.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.treatments}
                        cx="50%"
                        cy="50%"
                        innerRadius={80} // Donut style
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        cornerRadius={5}
                      >
                        {data.treatments.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        // FIX ERRORE TYPE: Cast a Number o fallback
                        formatter={(value: any) => [Number(value || 0), 'Eseguiti']}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-sm text-muted-foreground">Nessun dato.</div>
                )}
                {/* Center Text - ORA CENTRATO PERFETTAMENTE */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                   <div className="text-center">
                      <div className="text-4xl font-bold">{data.treatments.reduce((a,b)=>a+b.value,0)}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Totali</div>
                   </div>
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Top 5 List */}
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Top 5 Trattamenti</CardTitle>
            <CardDescription>Classifica per volume di vendita.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="rounded-2xl border bg-card overflow-hidden">
               {data.treatments.slice(0, 5).map((t, idx) => (
                 <div key={t.name} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-muted/30 transition-colors">
                   <div className="flex items-center gap-3">
                     <div 
                       className="w-2 h-8 rounded-full" 
                       style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} 
                     />
                     <div>
                        <div className="font-medium text-sm text-foreground">{t.name}</div>
                        <div className="text-xs text-muted-foreground">Rank #{idx + 1}</div>
                     </div>
                   </div>
                   <Badge variant="secondary" className="font-mono">{t.value}</Badge>
                 </div>
               ))}
               {data.treatments.length === 0 && (
                 <div className="p-6 text-center text-sm text-muted-foreground">Nessun dato disponibile.</div>
               )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- MICRO COMPONENTS ---

function KpiCard({ title, value, icon: Icon, trendColor }: any) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-foreground">{value}</h3>
      </div>
      <div className={cn("p-3 rounded-xl", trendColor)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function FunnelRow({ label, value, color, icon: Icon }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
       <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-md text-white shadow-sm", color)}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium">{label}</span>
       </div>
       <span className="font-bold text-sm">{value}</span>
    </div>
  )
}