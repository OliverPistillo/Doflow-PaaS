'use client';

import * as React from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, User, Phone, Mail, Trophy, MoreHorizontal, CalendarClock, Crown, BedDouble } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';

// --- TIPI ---
type Cliente = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  total_spent_cents: number; 
  last_visit_at: string | null;
  total_appointments: number;
  is_vip: boolean; 
};

type StatsData = {
  topClients: { name: string; value: number }[];
};

// --- HELPER ---
function money(cents: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

function daysAgo(dateStr: string | null) {
  if (!dateStr) return 'Mai';
  const diff = new Date().getTime() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 3600 * 24));
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Ieri';
  return `${days} gg fa`;
}

const BAR_COLORS = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'];

export default function FedericaClientiPage() {
  const [clients, setClients] = React.useState<Cliente[]>([]);
  const [stats, setStats] = React.useState<StatsData | null>(null);
  
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Dialog Crea/Modifica
  const [isOpen, setIsOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [formName, setFormName] = React.useState('');
  const [formPhone, setFormPhone] = React.useState('');
  const [formEmail, setFormEmail] = React.useState('');
  const [formNotes, setFormNotes] = React.useState('');

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [resList, resStats] = await Promise.all([
        apiFetch<{ clienti: Cliente[] }>(`/clienti?q=${search}`),
        apiFetch<StatsData>('/clienti/stats')
      ]);
      setClients(resList.clienti || []);
      setStats(resStats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Gestione Form
  const openNew = () => {
    setEditId(null);
    setFormName(''); setFormPhone(''); setFormEmail(''); setFormNotes('');
    setIsOpen(true);
  };

  const openEdit = (c: Cliente) => {
    setEditId(c.id);
    setFormName(c.full_name);
    setFormPhone(c.phone || '');
    setFormEmail(c.email || '');
    setFormNotes(c.notes || '');
    setIsOpen(true);
  };

  const handleSave = async () => {
    try {
      const body = { full_name: formName, phone: formPhone, email: formEmail, notes: formNotes };
      if (editId) {
        await apiFetch(`/clienti/${editId}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/clienti', { method: 'POST', body: JSON.stringify(body) });
      }
      setIsOpen(false);
      void loadData();
    } catch (e) {
      alert('Errore salvataggio');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare cliente?')) return;
    try {
      await apiFetch(`/clienti/${id}`, { method: 'DELETE' });
      void loadData();
    } catch (e) { console.error(e); }
  };

  // --- CALCOLO KPI LOCALI ---
  const vipCount = clients.filter(c => c.is_vip).length;
  const dormantCount = clients.filter(c => {
    const daysSinceLast = c.last_visit_at ? Math.floor((new Date().getTime() - new Date(c.last_visit_at).getTime()) / (1000 * 3600 * 24)) : 999;
    return daysSinceLast > 60 && c.total_appointments > 0;
  }).length;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-transparent space-y-8 pb-20">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-border/40 pb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Clienti</h1>
            <p className="text-sm text-muted-foreground mt-2">
               Gestisci l'anagrafica, analizza lo storico e identifica i top spender.
            </p>
          </div>
          <Button onClick={openNew} size="lg" className="shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Nuovo Cliente
          </Button>
        </div>

        {/* --- STATS SECTION (BENTO STYLE) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Chart */}
          <div className="lg:col-span-2 rounded-2xl border bg-card text-card-foreground shadow-sm p-6 relative">
             <div className="mb-4 flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                   <h3 className="font-semibold text-lg">Top Clienti</h3>
                   <p className="text-sm text-muted-foreground">Classifica per fatturato generato.</p>
                </div>
             </div>
             
             <div className="h-[200px] w-full">
               {stats && stats.topClients.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={stats.topClients} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                     <Tooltip
                       cursor={{ fill: 'transparent' }}
                       content={({ active, payload }) => {
                         if (active && payload && payload.length) {
                           return (
                             <div className="rounded-lg border bg-background p-2 shadow-xl text-xs font-medium">
                               <div className="text-muted-foreground mb-1">{payload[0].payload.name}</div>
                               <div className="text-emerald-600 text-base font-bold">€{Number(payload[0].value).toFixed(2)}</div>
                             </div>
                           )
                         }
                         return null;
                       }}
                     />
                     <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                         {stats.topClients.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                         ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                   Dati insufficienti.
                 </div>
               )}
             </div>
          </div>
          
          {/* Side KPI Cards (Numeri PURI) */}
          <div className="flex flex-col gap-6">
             <div className="flex-1 rounded-2xl border bg-card p-6 flex flex-col justify-center shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                   <Crown className="h-4 w-4 text-amber-500" />
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Totale VIP</h4>
                </div>
                <div className="text-3xl font-bold">{vipCount}</div>
                <div className="text-xs text-muted-foreground mt-1">Clienti con alta spesa</div>
             </div>

             <div className="flex-1 rounded-2xl border bg-card p-6 flex flex-col justify-center shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                   <BedDouble className="h-4 w-4 text-slate-400" />
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dormienti</h4>
                </div>
                <div className="text-3xl font-bold">{dormantCount}</div>
                <div className="text-xs text-muted-foreground mt-1">Assenti da {'>'}60gg</div>
             </div>
          </div>
        </div>

        {/* --- LISTA CLIENTI --- */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Elenco Completo ({clients.length})</h2>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cerca cliente..." 
                className="pl-9 bg-background border-muted hover:border-emerald-300 transition-colors focus-visible:ring-emerald-500" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {clients.map(c => {
              const isVip = c.is_vip; 
              const daysSinceLast = c.last_visit_at ? Math.floor((new Date().getTime() - new Date(c.last_visit_at).getTime()) / (1000 * 3600 * 24)) : 999;
              const isDormant = daysSinceLast > 60 && c.total_appointments > 0;

              return (
                <div key={c.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-card hover:shadow-md hover:border-emerald-200 transition-all duration-200">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold border border-emerald-100">
                      {c.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/federicanerone/clienti/${c.id}`} className="font-semibold text-foreground text-base hover:underline decoration-emerald-500/50 underline-offset-4">
                           {c.full_name}
                        </Link>
                        {isVip && (
                          <UITooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] h-5 px-1.5 cursor-help">VIP</Badge>
                            </TooltipTrigger>
                            <TooltipContent>Cliente alto valore</TooltipContent>
                          </UITooltip>
                        )}
                        {isDormant && <Badge variant="outline" className="text-gray-500 border-gray-200 text-[10px] h-5 px-1.5">Inattivo {daysSinceLast}gg</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1.5">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Spesa Totale</div>
                      <div className="font-bold text-emerald-600">{money(c.total_spent_cents)}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Ultima Visita</div>
                      <div className="font-medium flex items-center justify-end gap-1">
                         <CalendarClock className="h-3 w-3 text-muted-foreground" />
                         {daysAgo(c.last_visit_at)}
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                         <DropdownMenuItem onClick={() => openEdit(c)}>Modifica Anagrafica</DropdownMenuItem>
                         <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(c.id)}>Elimina Cliente</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
            
            {clients.length === 0 && !loading && (
               <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/10">
                 <User className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                 <h3 className="font-medium text-foreground">Nessun cliente trovato</h3>
                 <p className="text-sm text-muted-foreground mt-1">Aggiungi il primo cliente per iniziare.</p>
               </div>
            )}
          </div>
        </div>

        {/* DIALOG CREA/MODIFICA */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? 'Modifica Cliente' : 'Nuovo Cliente'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Es. Mario Rossi" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefono</Label>
                  <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="333..." />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Allergie, preferenze..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Annulla</Button>
              <Button onClick={handleSave}>Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}