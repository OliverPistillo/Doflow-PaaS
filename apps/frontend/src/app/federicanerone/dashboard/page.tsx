// apps\frontend\src\app\federicanerone\dashboard\page.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  Users, 
  PhoneMissed, 
  CalendarCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  DollarSign,
  Activity,
  ArrowRight,
  ChevronRight,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  CartesianGrid
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

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

const CHART_COLOR_PRIMARY = '#10b981'; // Emerald
const BAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981'];

export default function FedericaDashboardPage() {
  const router = useRouter();
  const [data, setData] = React.useState<StatsResponse | null>(null);
  const [year, setYear] = React.useState<string>(String(new Date().getFullYear()));
  const [loading, setLoading] = React.useState(false);

  // --- STATO DEL POPUP UNICO ---
  // modalType definisce cosa mostrare dentro il dialog
  type ModalType = 'KPI_REVENUE' | 'KPI_CLIENTS' | 'KPI_APPS' | 'STATUS_DETAIL' | 'TREATMENT_DETAIL' | null;
  
  const [modalType, setModalType] = React.useState<ModalType>(null);
  const [modalData, setModalData] = React.useState<any>(null); // Dati dinamici da passare al modale

  const openModal = (type: ModalType, data: any = {}) => {
    setModalData(data);
    setModalType(type);
  };

  const closeModal = () => {
    setModalType(null);
    setModalData(null);
  };

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

  if (!data && loading) return <div className="flex h-screen items-center justify-center text-muted-foreground animate-pulse">Analisi dati in corso...</div>;
  if (!data) return <div className="flex h-screen items-center justify-center text-red-500">Errore caricamento dati.</div>;

  // Preparazione dati grafici
  const chartMonthly = data.monthly.map(m => ({
    name: MONTH_NAMES[m.month - 1],
    Fatturato: m.value
  }));

  const sortedTreatments = [...data.treatments].sort((a, b) => b.value - a.value).slice(0, 5);
  const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  // --- RENDER CONTENT DEL MODALE ---
  // Questa funzione decide cosa renderizzare dentro il popup in base al tipo
  const renderModalContent = () => {
    if (!modalType) return null;

    switch (modalType) {
      case 'KPI_REVENUE':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700">
                <DollarSign className="h-5 w-5" /> Analisi Fatturato {year}
              </DialogTitle>
              <DialogDescription>Dettaglio delle entrate registrate.</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
               <div className="text-center">
                 <div className="text-4xl font-bold text-emerald-600">{eur.format(data.kpi.fatturato_eur)}</div>
                 <p className="text-sm text-muted-foreground mt-1">Totale Incassato (Appuntamenti Eseguiti)</p>
               </div>
               <div className="bg-muted/30 p-4 rounded-lg text-sm border">
                 <p>💡 <strong>Insight:</strong> Questo valore include solo gli appuntamenti segnati come "Eseguito". I prenotati non sono ancora contabilizzati.</p>
               </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal}>Chiudi</Button>
              <Button onClick={() => router.push(`/federicanerone/appuntamenti?year=${year}&status=closed_won&view=list`)}>
                 Vedi Storico Pagamenti <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        );

      case 'KPI_CLIENTS':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-700">
                <Users className="h-5 w-5" /> Nuovi Clienti
              </DialogTitle>
              <DialogDescription>Acquisizione clienti nell'anno {year}.</DialogDescription>
            </DialogHeader>
            <div className="py-6 grid grid-cols-2 gap-4">
               <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
                 <div className="text-3xl font-bold text-blue-600">{data.kpi.new_lead}</div>
                 <p className="text-xs text-muted-foreground uppercase mt-1">Acquisiti</p>
               </div>
               <div className="text-center p-4 bg-muted/50 rounded-xl">
                 <div className="text-3xl font-bold text-foreground">--%</div>
                 <p className="text-xs text-muted-foreground uppercase mt-1">Retention</p>
               </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal}>Chiudi</Button>
              <Button onClick={() => router.push('/federicanerone/clienti?sort=created_desc')}>
                 Vai alla Rubrica <Users className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        );

      case 'STATUS_DETAIL':
        const { statusLabel, statusValue, statusKey, colorClass } = modalData;
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                 <div className={cn("w-3 h-3 rounded-full", colorClass.replace('bg-', 'bg-'))} /> 
                 Dettaglio: {statusLabel}
              </DialogTitle>
              <DialogDescription>Gestione operativa della pipeline.</DialogDescription>
            </DialogHeader>
            <div className="py-6">
               <div className="flex items-center justify-between p-4 border rounded-xl bg-card shadow-sm">
                  <span className="text-muted-foreground">Quantità attuale</span>
                  <span className="text-2xl font-bold">{statusValue}</span>
               </div>
               <p className="mt-4 text-sm text-muted-foreground">
                 Cliccando qui sotto verrai reindirizzato alla lista filtrata per gestire questi specifici appuntamenti.
               </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={closeModal}>Indietro</Button>
              <Button onClick={() => router.push(`/federicanerone/appuntamenti?status=${statusKey}`)}>
                 Gestisci {statusLabel} <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        );

      case 'TREATMENT_DETAIL':
        const { tName, tValue } = modalData;
        return (
           <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                 <BarChart3 className="h-5 w-5 text-primary"/>
                 {tName}
              </DialogTitle>
              <DialogDescription>Statistiche di vendita per questo servizio.</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
               <div className="p-6 bg-muted/20 border rounded-xl flex flex-col items-center">
                  <span className="text-4xl font-bold text-foreground">{tValue}</span>
                  <span className="text-sm text-muted-foreground mt-1 uppercase tracking-wider">Esecuzioni totali</span>
               </div>
               <div className="text-sm text-muted-foreground px-2">
                 Questo servizio rappresenta una parte importante del tuo fatturato annuale.
               </div>
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={closeModal}>Chiudi</Button>
               <Button onClick={() => router.push(`/federicanerone/appuntamenti?search=${encodeURIComponent(tName)}`)}>
                  Cerca in Agenda
               </Button>
            </DialogFooter>
           </>
        );

      default:
        return null;
    }
  };


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
            <SelectTrigger className="w-[120px] bg-background shadow-sm">
              <SelectValue placeholder="Anno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadStats} disabled={loading} className="shrink-0 shadow-sm">
            <Activity className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* --- SEZIONE KPI (Cliccabili -> Popup) --- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div onClick={() => openModal('KPI_REVENUE')} className="cursor-pointer group">
            <KpiCard 
              title="Fatturato Totale" 
              value={eur.format(data.kpi.fatturato_eur)} 
              icon={DollarSign} 
              trendColor="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
              borderColor="group-hover:border-emerald-500/50"
            />
        </div>

        <div onClick={() => openModal('KPI_CLIENTS')} className="cursor-pointer group">
            <KpiCard 
              title="Nuovi Clienti" 
              value={data.kpi.new_lead} 
              icon={Users}
              trendColor="text-blue-600 bg-blue-50 dark:bg-blue-950/30"
              borderColor="group-hover:border-blue-500/50"
            />
        </div>

        {/* Questo KPI apre semplicemente il calendario, senza popup intermedio perché è un'azione diretta molto comune */}
        <div onClick={() => router.push('/federicanerone/appuntamenti')} className="cursor-pointer group">
            <KpiCard 
              title="Appuntamenti Totali" 
              value={data.kpi.booked + data.kpi.closed_won} 
              icon={CalendarCheck}
              trendColor="text-violet-600 bg-violet-50 dark:bg-violet-950/30"
              borderColor="group-hover:border-violet-500/50"
            />
        </div>

        <div className="cursor-default select-none">
            <KpiCard 
              title="Tasso Conversione" 
              value={`${data.kpi.closed_won > 0 ? Math.round((data.kpi.closed_won / (data.kpi.booked + data.kpi.closed_won + data.kpi.closed_lost)) * 100) : 0}%`}
              icon={TrendingUp}
              trendColor="text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30"
            />
        </div>
      </div>

      {/* --- MAIN GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">
        
        {/* Main Chart: Fatturato */}
        <div className="lg:col-span-2 rounded-2xl border bg-card text-card-foreground shadow-sm p-6 relative">
           <div className="mb-6 flex items-center justify-between">
             <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    Andamento Fatturato
                </h3>
                <p className="text-sm text-muted-foreground">Distribuzione mensile delle entrate.</p>
             </div>
             <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Yearly</Badge>
           </div>
           
           <div className="h-[320px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartMonthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor={CHART_COLOR_PRIMARY} stopOpacity={0.3}/>
                     <stop offset="95%" stopColor={CHART_COLOR_PRIMARY} stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                 <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} stroke="#9ca3af" />
                 <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} stroke="#9ca3af" />
                 <Tooltip 
                   cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
                   content={({ active, payload }) => {
                     if (active && payload && payload.length) {
                       return (
                         <div className="rounded-lg border bg-background p-3 shadow-xl text-xs font-medium">
                           <div className="text-muted-foreground mb-1 uppercase tracking-wider">{payload[0].payload.name}</div>
                           <div className="text-emerald-600 text-lg font-bold">
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
                   stroke={CHART_COLOR_PRIMARY} 
                   strokeWidth={3}
                   fillOpacity={1} 
                   fill="url(#colorRevenue)" 
                   activeDot={{ r: 6, strokeWidth: 0 }}
                 />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Funnel Stats (Cliccabili -> Popup) */}
        <div className="space-y-6">
           <div className="rounded-2xl border bg-card p-6 h-full flex flex-col">
              <h3 className="font-semibold text-lg mb-1">Pipeline Appuntamenti</h3>
              <p className="text-sm text-muted-foreground mb-6">Clicca su uno stato per i dettagli.</p>
              
              <div className="space-y-3 flex-1">
                 <FunnelRow 
                    label="Eseguiti (Won)" 
                    value={data.kpi.closed_won} 
                    color="bg-emerald-500" 
                    icon={CheckCircle2} 
                    onClick={() => openModal('STATUS_DETAIL', { statusLabel: 'Eseguiti', statusValue: data.kpi.closed_won, statusKey: 'closed_won', colorClass: 'bg-emerald-500' })}
                 />
                 <FunnelRow 
                    label="Prenotati (Booked)" 
                    value={data.kpi.booked} 
                    color="bg-blue-500" 
                    icon={CalendarCheck} 
                    onClick={() => openModal('STATUS_DETAIL', { statusLabel: 'Prenotati', statusValue: data.kpi.booked, statusKey: 'booked', colorClass: 'bg-blue-500' })}
                 />
                 <FunnelRow 
                    label="In Attesa (Waiting)" 
                    value={data.kpi.waiting} 
                    color="bg-amber-400" 
                    icon={Clock} 
                    onClick={() => openModal('STATUS_DETAIL', { statusLabel: 'In Attesa', statusValue: data.kpi.waiting, statusKey: 'waiting', colorClass: 'bg-amber-400' })}
                 />
                 <FunnelRow 
                    label="No Risposta" 
                    value={data.kpi.no_answer} 
                    color="bg-orange-400" 
                    icon={PhoneMissed} 
                    onClick={() => openModal('STATUS_DETAIL', { statusLabel: 'No Risposta', statusValue: data.kpi.no_answer, statusKey: 'no_answer', colorClass: 'bg-orange-400' })}
                 />
                 <FunnelRow 
                    label="Persi (Lost)" 
                    value={data.kpi.closed_lost} 
                    color="bg-red-400" 
                    icon={XCircle} 
                    onClick={() => openModal('STATUS_DETAIL', { statusLabel: 'Persi', statusValue: data.kpi.closed_lost, statusKey: 'closed_lost', colorClass: 'bg-red-400' })}
                 />
              </div>
           </div>
        </div>
      </div>

      {/* --- BOTTOM ROW: PRODUCTS & INSIGHTS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CHART: Top Servizi (Bar Chart Orizzontale) */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
           <div className="mb-6">
             <h3 className="font-semibold text-lg">Performance Servizi</h3>
             <p className="text-sm text-muted-foreground">Volume di vendita per tipologia.</p>
           </div>
           
           <div className="h-[300px] w-full">
             {sortedTreatments.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart 
                   layout="vertical" 
                   data={sortedTreatments} 
                   margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                   barCategoryGap={20}
                 >
                   <XAxis type="number" hide />
                   <YAxis 
                     dataKey="name" 
                     type="category" 
                     width={150} 
                     tick={{ fontSize: 12, fill: '#6b7280' }} 
                     axisLine={false}
                     tickLine={false}
                   />
                   <Tooltip 
                     cursor={{ fill: 'transparent' }}
                     content={({ active, payload }) => {
                       if (active && payload && payload.length) {
                         return (
                           <div className="bg-popover text-popover-foreground px-3 py-1.5 rounded-md text-xs border shadow-md font-medium">
                             {payload[0].value} Esecuzioni
                           </div>
                         )
                       }
                       return null;
                     }}
                   />
                   <Bar 
                     dataKey="value" 
                     radius={[0, 4, 4, 0]} 
                     barSize={24}
                     // Rendiamo le barre cliccabili
                     onClick={(data) => openModal('TREATMENT_DETAIL', { tName: data.name, tValue: data.value })}
                     cursor="pointer"
                   >
                      {sortedTreatments.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Nessun dato disponibile.</div>
             )}
           </div>
        </div>

        {/* Top 5 List (Cliccabile -> Popup) */}
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Classifica Dettagliata</CardTitle>
            <CardDescription>Clicca su un servizio per analizzarlo.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="rounded-2xl border bg-card overflow-hidden">
               {sortedTreatments.map((t, idx) => (
                 <div 
                    key={t.name} 
                    onClick={() => openModal('TREATMENT_DETAIL', { tName: t.name, tValue: t.value })}
                    className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer group"
                 >
                   <div className="flex items-center gap-4">
                     <div className="font-bold text-muted-foreground/50 text-lg w-4">#{idx + 1}</div>
                     <div>
                        <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.value} vendite quest'anno</div>
                     </div>
                   </div>
                   <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                 </div>
               ))}
               {sortedTreatments.length === 0 && (
                 <div className="p-6 text-center text-sm text-muted-foreground">Nessun dato disponibile.</div>
               )}
            </div>
            
            <div className="mt-4 text-center">
               <Button variant="link" onClick={() => router.push('/federicanerone/trattamenti')} className="text-primary">
                  Vedi Catalogo Completo <ArrowRight className="ml-1 h-3 w-3" />
               </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- GLOBAL POPUP / DIALOG --- */}
      <Dialog open={!!modalType} onOpenChange={(open) => !open && closeModal()}>
         <DialogContent className="sm:max-w-md">
            {renderModalContent()}
         </DialogContent>
      </Dialog>
    </div>
  );
}

// --- MICRO COMPONENTS ---

function KpiCard({ title, value, icon: Icon, trendColor, borderColor = "border-border" }: any) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-200", borderColor)}>
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

function FunnelRow({ label, value, color, icon: Icon, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-between p-3 rounded-lg border bg-background/50 hover:bg-background transition-colors cursor-pointer group"
    >
       <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-md text-white shadow-sm transition-transform group-hover:scale-110", color)}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium group-hover:text-foreground/80 transition-colors">{label}</span>
       </div>
       <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{value}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
       </div>
    </div>
  )
}