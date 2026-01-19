'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Plus, 
  Sparkles, 
  Clock, 
  MoreHorizontal, 
  TrendingUp, 
  Zap, 
  Trophy,
  Banknote,
  Activity,
  Layers
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from "@/lib/utils";

// --- TIPI ---

type Trattamento = {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  total_revenue_cents: number;
  executed_count: number;
  category?: string;
  badge_color?: string;
  is_active: boolean;
};

type StatsData = {
  topRevenue: { name: string; value: number }[];
};

// --- HELPER & UTILS ---

function money(cents: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

function getHourlyRate(cents: number, minutes: number) {
  if (!minutes) return 0;
  const price = cents / 100;
  return (price / minutes) * 60;
}

const CHART_COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

export default function FedericaTrattamentiPage() {
  const [items, setItems] = React.useState<Trattamento[]>([]);
  const [stats, setStats] = React.useState<StatsData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Dialog State
  const [isOpen, setIsOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [formName, setFormName] = React.useState('');
  const [formPrice, setFormPrice] = React.useState('');
  const [formDuration, setFormDuration] = React.useState('');

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [resList, resStats] = await Promise.all([
        apiFetch<{ trattamenti: Trattamento[] }>(`/trattamenti?q=${search}`),
        apiFetch<StatsData>('/trattamenti/stats')
      ]);
      setItems(resList.trattamenti || []);
      setStats(resStats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    const t = setTimeout(() => void loadData(), 300);
    return () => clearTimeout(t);
  }, [loadData]);

  // Gestione Form
  const openNew = () => {
    setEditId(null);
    setFormName(''); setFormPrice(''); setFormDuration('');
    setIsOpen(true);
  };

  const openEdit = (t: Trattamento) => {
    setEditId(t.id);
    setFormName(t.name);
    setFormPrice(String(t.price_cents / 100));
    setFormDuration(String(t.duration_minutes));
    setIsOpen(true);
  };

  const handleSave = async () => {
    try {
      const body = {
        name: formName,
        price_cents: Math.round(Number(formPrice.replace(',', '.')) * 100),
        duration_minutes: Number(formDuration),
        is_active: true
      };
      
      if (editId) {
        await apiFetch(`/trattamenti/${editId}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/trattamenti', { method: 'POST', body: JSON.stringify(body) });
      }
      setIsOpen(false);
      void loadData();
    } catch (e) { alert('Errore salvataggio'); }
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Sei sicuro? Questa azione è irreversibile.")) return;
    try {
      await apiFetch(`/trattamenti/${id}`, { method: 'DELETE' });
      void loadData();
    } catch(e) { alert("Impossibile eliminare se ci sono appuntamenti collegati."); }
  };

  // --- CALCOLO KPI AGGREGATI ---
  const sortedByExecution = [...items].sort((a, b) => Number(b.executed_count) - Number(a.executed_count));
  const bestSellerItem = sortedByExecution.length > 0 ? sortedByExecution[0] : null;
  const maxExecuted = bestSellerItem ? Number(bestSellerItem.executed_count) : 0;

  const validItems = items.filter(i => i.duration_minutes > 0);
  const avgHourlyRate = validItems.length > 0
    ? validItems.reduce((acc, curr) => acc + getHourlyRate(curr.price_cents, curr.duration_minutes), 0) / validItems.length
    : 0;

  const totalRevenueAll = items.reduce((acc, curr) => acc + Number(curr.total_revenue_cents), 0);
  const totalExecutionsAll = items.reduce((acc, curr) => acc + Number(curr.executed_count), 0);
  const avgTicket = totalExecutionsAll > 0 ? (totalRevenueAll / totalExecutionsAll) : 0;

  return (
    <div className="min-h-screen bg-transparent space-y-8 pb-20">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Trattamenti</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg">
            Analisi del catalogo servizi e performance economica.
          </p>
        </div>
        <Button 
          onClick={openNew} 
          size="lg" 
          // STILE: Cipria chiaro sfondo, Blu Navy testo
          className="shadow-lg shadow-pink-200/50 bg-pink-200 text-blue-900 font-medium border-0 transition-all hover:bg-pink-300 hover:scale-[1.02]"
        >
          <Plus className="mr-2 h-4 w-4" /> Nuovo Trattamento
        </Button>
      </div>

      {/* --- BENTO GRID STATS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Chart Card */}
        <div className="md:col-span-2 rounded-2xl border bg-card text-card-foreground shadow-sm p-6 relative overflow-hidden group">
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">Top Revenue</h3>
                <p className="text-sm text-muted-foreground">Servizi con maggior impatto sul fatturato.</p>
              </div>
              <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100">Yearly</Badge>
            </div>
            
            <div className="h-[200px] w-full">
               {stats && stats.topRevenue.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={stats.topRevenue} barSize={40}>
                     <XAxis 
                        dataKey="name" 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(v) => v.length > 10 ? `${v.substring(0,10)}...` : v} 
                     />
                     <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-xl text-xs font-medium">
                                <div className="text-muted-foreground mb-1">{payload[0].payload.name}</div>
                                <div className="text-indigo-600 text-base">€{Number(payload[0].value).toFixed(2)}</div>
                              </div>
                            )
                          }
                          return null;
                        }}
                     />
                     <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                       {stats.topRevenue.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Dati insufficienti</div>
               )}
            </div>
          </div>
        </div>

        {/* Side Cards */}
        <div className="space-y-6 flex flex-col">
          
          {/* Card: Performance Listino */}
          <div className="flex-1 rounded-2xl border bg-card p-6 flex flex-col justify-center relative overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <Banknote className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Performance Listino</h4>
            </div>
            
            <div className="mb-4">
              <div className="text-3xl font-bold text-foreground">
                {money(avgTicket)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ticket medio per servizio</p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
               <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Volumi</div>
                  <div className="font-semibold flex items-center gap-1">
                     <Layers className="h-3 w-3 text-indigo-500" />
                     {totalExecutionsAll}
                  </div>
               </div>
               <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Efficienza</div>
                  <div className="font-semibold flex items-center gap-1">
                     <Zap className="h-3 w-3 text-amber-500" />
                     €{avgHourlyRate.toFixed(0)}/h
                  </div>
               </div>
            </div>
          </div>

          {/* Card: Best Seller */}
          <div className="flex-1 rounded-2xl border bg-card p-6 flex flex-col justify-center relative overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <Trophy className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Best Seller</h4>
            </div>
             <div>
               {bestSellerItem ? (
                 <>
                  <div className="text-xl font-bold text-foreground truncate" title={bestSellerItem.name}>
                    {bestSellerItem.name}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100">
                       {bestSellerItem.executed_count} vendite
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                       {money(bestSellerItem.total_revenue_cents)} tot.
                    </span>
                  </div>
                 </>
               ) : (
                 <div className="text-sm text-muted-foreground">Nessun dato</div>
               )}
             </div>
          </div>
        </div>
      </div>

      {/* --- LISTA TRATTAMENTI --- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Catalogo ({items.length})</h2>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cerca..." 
              className="pl-9 bg-background border-muted hover:border-indigo-300 transition-colors focus-visible:ring-indigo-500" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {items.map((t) => {
            const hourlyRate = getHourlyRate(t.price_cents, t.duration_minutes);
            const isHighProfit = hourlyRate >= 60;
            const isBestSeller = t.executed_count > 0 && Number(t.executed_count) === maxExecuted;

            return (
              <div 
                key={t.id} 
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-card hover:shadow-md hover:border-indigo-200 transition-all duration-200"
              >
                {/* Left: Info */}
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
                    isHighProfit ? "bg-emerald-50 text-emerald-600" : "bg-muted text-muted-foreground"
                  )}>
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-base">{t.name}</span>
                      {isBestSeller && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200 text-[10px] h-5 px-1.5">
                          Best Seller
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded-md">
                        <Clock className="h-3 w-3" /> {t.duration_minutes} min
                      </span>
                      <span className="font-medium text-foreground">
                        {money(t.price_cents)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Metrics & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-6 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-border/50">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Resa / Ora</div>
                    <div className={cn(
                      "text-sm font-bold flex items-center justify-end gap-1",
                      isHighProfit ? "text-emerald-600" : "text-foreground"
                    )}>
                      €{hourlyRate.toFixed(0)}
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                     <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Totale</div>
                     <div className="text-sm font-medium">{money(t.total_revenue_cents)}</div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Azioni</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openEdit(t)}>Modifica</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(t.id)} className="text-red-600 focus:text-red-600">
                        Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
          
          {items.length === 0 && !loading && (
             <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/10">
               <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
               <h3 className="font-medium text-foreground">Nessun trattamento trovato</h3>
               <p className="text-sm text-muted-foreground mt-1">Aggiungine uno nuovo per iniziare.</p>
             </div>
          )}
        </div>
      </div>

      {/* --- DIALOG --- */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editId ? 'Modifica Servizio' : 'Nuovo Servizio'}</DialogTitle>
            <DialogDescription>
              Inserisci i dettagli. La resa oraria viene calcolata in tempo reale.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Servizio</Label>
              <Input 
                id="name" 
                value={formName} 
                onChange={e => setFormName(e.target.value)} 
                placeholder="Es. Pulizia Viso Deluxe"
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Prezzo (€)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">€</span>
                  <Input 
                    id="price" 
                    value={formPrice} 
                    onChange={e => setFormPrice(e.target.value)} 
                    placeholder="50" 
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Durata (min)</Label>
                <div className="relative">
                   <Input 
                    id="duration" 
                    value={formDuration} 
                    onChange={e => setFormDuration(e.target.value)} 
                    placeholder="60" 
                  />
                  <span className="absolute right-3 top-2.5 text-muted-foreground text-xs">min</span>
                </div>
              </div>
            </div>
            
            {/* Live Preview of Hourly Rate in Dialog */}
            {formPrice && formDuration && (
               <div className="rounded-lg bg-muted/50 p-3 flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Resa stimata:</span>
                  <span className={cn(
                     "font-bold",
                     getHourlyRate(Number(formPrice)*100, Number(formDuration)) >= 60 ? "text-emerald-600" : "text-foreground"
                  )}>
                     €{getHourlyRate(Number(formPrice)*100, Number(formDuration)).toFixed(0)}/ora
                  </span>
               </div>
            )}

          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsOpen(false)}>Annulla</Button>
             <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}