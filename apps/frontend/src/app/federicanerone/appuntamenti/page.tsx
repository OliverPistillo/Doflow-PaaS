'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Calendar as CalendarIcon, 
  List, 
  RefreshCw, 
  Plus, 
  Check, 
  X, 
  Trash2, 
  Clock, 
  UserPlus, 
  ChevronLeft, 
  ChevronRight,
  Search,
  CalendarDays,
  Sparkles,
  MoreHorizontal,
  Briefcase
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

// --- TIPI ---

type AppuntamentoStatus =
  | 'new_lead'
  | 'no_answer'
  | 'waiting'
  | 'booked'
  | 'closed_won'
  | 'closed_lost';

type Appuntamento = {
  id: string;
  client_id: string;
  treatment_id: string;
  starts_at: string;
  ends_at: string | null;
  final_price_cents: number | null;
  notes: string | null;
  status: AppuntamentoStatus;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
};

type Cliente = { id: string; full_name: string; phone?: string; email?: string };
type Trattamento = { id: string; name: string; price_cents: number; duration_minutes: number };

type ListResponse = { appuntamenti: Appuntamento[] };
type CreateResponse = { appuntamento: Appuntamento };
type UpdateResponse = { appuntamento: Appuntamento };

// --- HELPER ---

const STATUS_CONFIG: Record<AppuntamentoStatus, { label: string, color: string, badge: string }> = {
  new_lead: { label: 'Nuovo Lead', color: 'border-l-slate-400', badge: 'bg-slate-100 text-slate-700' },
  no_answer: { label: 'No Risposta', color: 'border-l-orange-400', badge: 'bg-orange-100 text-orange-700' },
  waiting: { label: 'In Attesa', color: 'border-l-amber-400', badge: 'bg-amber-100 text-amber-700' },
  booked: { label: 'Prenotato', color: 'border-l-indigo-500', badge: 'bg-indigo-100 text-indigo-700' },
  closed_won: { label: 'Eseguito', color: 'border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  closed_lost: { label: 'Annullato', color: 'border-l-rose-500', badge: 'bg-rose-100 text-rose-700 opacity-70' },
};

function moneyFromCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

function fromDatetimeLocalValue(v: string): string {
  return new Date(v).toISOString();
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => n < 10 ? '0' + n : n;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function FedericaAppuntamentiPage() {
  const [items, setItems] = React.useState<Appuntamento[]>([]);
  const [clienti, setClienti] = React.useState<Cliente[]>([]);
  const [trattamenti, setTrattamenti] = React.useState<Trattamento[]>([]);
  const [loading, setLoading] = React.useState(false);
  
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = React.useState<Date>(() => new Date());

  // Filters
  const [filterFrom, setFilterFrom] = React.useState('');
  const [filterTo, setFilterTo] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');

  // --- STATO MODALI ---
  const [isCreateOpen, setIsCreateOpen] = React.useState(false); 

  // Form Creazione
  const [inputClientName, setInputClientName] = React.useState(''); 
  const [selectedClientId, setSelectedClientId] = React.useState<string | null>(null);
  const [treatmentId, setTreatmentId] = React.useState('');
  const [startsAt, setStartsAt] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [finalPrice, setFinalPrice] = React.useState('');

  // Stati per creazione nuovo cliente "al volo"
  const [showNewClientAlert, setShowNewClientAlert] = React.useState(false);
  const [showNewClientForm, setShowNewClientForm] = React.useState(false);
  const [newClientPhone, setNewClientPhone] = React.useState('');
  const [newClientEmail, setNewClientEmail] = React.useState('');

  // LOAD DATA
  const loadAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterFrom) qs.set('from', filterFrom);
      if (filterTo) qs.set('to', filterTo);
      
      const [resApp, resCli, resTrat] = await Promise.all([
        apiFetch<ListResponse>(`/appuntamenti?${qs.toString()}`),
        apiFetch<{ clienti: Cliente[] }>('/clienti'),
        apiFetch<{ trattamenti: Trattamento[] }>('/trattamenti')
      ]);

      setItems(Array.isArray(resApp?.appuntamenti) ? resApp.appuntamenti : []);
      setClienti(Array.isArray(resCli?.clienti) ? resCli.clienti : []);
      setTrattamenti(Array.isArray(resTrat?.trattamenti) ? resTrat.trattamenti : []);

    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [filterFrom, filterTo]);

  React.useEffect(() => { void loadAll(); }, [loadAll]);

  // KPI CALCULATIONS
  const today = new Date();
  const todayApps = items.filter(i => sameDay(new Date(i.starts_at), today));
  const waitingApps = items.filter(i => i.status === 'waiting' || i.status === 'new_lead');
  const monthAppsCount = items.filter(i => {
     const d = new Date(i.starts_at);
     return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
  }).length;

  // RESET FORM quando si apre il dialog
  React.useEffect(() => {
    if (isCreateOpen) {
      if (!startsAt) {
        const defaultDate = new Date(selectedDay);
        // Se il giorno selezionato è oggi, mettiamo l'ora attuale arrotondata, altrimenti le 9:00
        if (sameDay(defaultDate, new Date())) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getMinutes() % 15); // arrotonda ai 15min
            setStartsAt(toDatetimeLocalValue(now));
        } else {
            defaultDate.setHours(9, 0, 0, 0);
            setStartsAt(toDatetimeLocalValue(defaultDate));
        }
      }
    }
  }, [isCreateOpen, selectedDay]); 

  // FORM HANDLERS
  const filteredClients = React.useMemo(() => {
    if (!inputClientName) return [];
    if (selectedClientId) return [];
    return clienti.filter(c => c.full_name.toLowerCase().includes(inputClientName.toLowerCase()));
  }, [clienti, inputClientName, selectedClientId]);

  const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputClientName(e.target.value);
    if (selectedClientId) setSelectedClientId(null);
    const match = clienti.find(c => c.full_name.toLowerCase() === e.target.value.toLowerCase());
    if (match) setSelectedClientId(match.id);
  };

  const selectClient = (c: Cliente) => {
    setInputClientName(c.full_name);
    setSelectedClientId(c.id);
  };

  React.useEffect(() => {
    if (treatmentId && !finalPrice) {
      const t = trattamenti.find(x => String(x.id) === treatmentId);
      if (t) setFinalPrice(String(t.price_cents / 100));
    }
  }, [treatmentId, trattamenti, finalPrice]);

  async function onPreCreate() {
    if (!treatmentId || !startsAt) return alert('Compila data e trattamento');
    if (selectedClientId) { 
      await doCreateAppointment(selectedClientId); 
      return; 
    }
    if (inputClientName.trim().length > 0) { 
      setShowNewClientAlert(true); 
    } else { 
      alert('Inserisci il nome del cliente.'); 
    }
  }

  async function doCreateAppointment(cid: string) {
    try {
      setLoading(true);
      const euros = finalPrice.trim();
      const final_price_cents = euros ? Math.round(Number(euros.replace(',', '.')) * 100) : null;
      const body = {
        client_id: cid, treatment_id: treatmentId,
        starts_at: fromDatetimeLocalValue(startsAt), ends_at: null,
        notes: notes.trim() || null, final_price_cents, status: 'booked',
      };
      await apiFetch<CreateResponse>('/appuntamenti', { method: 'POST', body: JSON.stringify(body) });
      
      setInputClientName(''); setSelectedClientId(null); setTreatmentId(''); 
      setStartsAt(''); setNotes(''); setFinalPrice('');
      setIsCreateOpen(false); 
      await loadAll(); 
    } catch (e: any) { alert('Errore creazione'); } finally { setLoading(false); }
  }

  async function handleCreateClientAndAppointment() {
    try {
      setLoading(true);
      const resCli = await apiFetch<{ cliente: Cliente }>('/clienti', {
        method: 'POST', body: JSON.stringify({ full_name: inputClientName, phone: newClientPhone, email: newClientEmail })
      });
      const newClient = resCli.cliente;
      setClienti(prev => [...prev, newClient]);
      setShowNewClientForm(false); setNewClientPhone(''); setNewClientEmail('');
      await doCreateAppointment(newClient.id);
    } catch (e: any) { alert('Errore creazione cliente'); setLoading(false); }
  }

  async function handleUpdateStatus(id: string, next: AppuntamentoStatus) {
    try {
      setLoading(true);
      await apiFetch<UpdateResponse>(`/appuntamenti/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      await loadAll(); 
    } catch (e) { console.error(e); setLoading(false); }
  }

  async function handleDelete(id: string) {
    if(!confirm("Eliminare appuntamento definitivamente?")) return;
    try {
      setLoading(true);
      await apiFetch<{ ok: boolean }>(`/appuntamenti/${id}`, { method: 'DELETE' });
      await loadAll();
    } catch (e) { console.error(e); setLoading(false); }
  }

  // CALENDAR LOGIC
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const monthItems = React.useMemo(() => {
    return items.filter((a) => {
      const s = new Date(a.starts_at).getTime();
      return s >= monthStart.getTime() && s <= monthEnd.getTime();
    });
  }, [items, monthStart, monthEnd]);

  const daysGrid = React.useMemo(() => {
    const first = startOfMonth(month);
    const dow = (first.getDay() + 6) % 7; 
    const start = new Date(first);
    start.setDate(first.getDate() - dow);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [month]);

  // Lista filtrata
  const filteredListItems = React.useMemo(() => {
     if (!searchQuery) return items;
     return items.filter(a => {
        const c = clienti.find(cl => cl.id === a.client_id);
        const t = trattamenti.find(tr => tr.id === a.treatment_id);
        const text = (c?.full_name + ' ' + t?.name).toLowerCase();
        return text.includes(searchQuery.toLowerCase());
     });
  }, [items, clienti, trattamenti, searchQuery]);


  return (
    <div className="min-h-screen bg-transparent space-y-8 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
             <CalendarDays className="h-8 w-8 text-foreground" /> Appuntamenti
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg">
            Gestisci l'agenda, prenota nuovi clienti e monitora lo stato dei lavori.
          </p>
        </div>
        <div className="flex gap-3">
            <Button variant="outline" size="lg" onClick={() => void loadAll()} disabled={loading} className="hidden sm:flex">
               <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} /> Aggiorna
            </Button>
            <Button 
                onClick={() => setIsCreateOpen(true)} 
                size="lg"
                className="shadow-lg shadow-pink-200/50 bg-pink-200 text-blue-900 font-medium border-0 transition-all hover:bg-pink-300 hover:scale-[1.02]"
            >
                <Plus className="mr-2 h-5 w-5" /> Nuovo Appuntamento
            </Button>
        </div>
      </div>

      {/* KPI / MINI DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl border bg-card shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-colors">
             <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Oggi</p>
                <div className="text-3xl font-bold mt-1 text-foreground">{todayApps.length}</div>
             </div>
             <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-100 transition-colors">
                <CalendarIcon className="h-6 w-6" />
             </div>
        </div>
        <div className="p-6 rounded-2xl border bg-card shadow-sm flex items-center justify-between group hover:border-amber-200 transition-colors">
             <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Da Confermare</p>
                <div className="text-3xl font-bold mt-1 text-foreground">{waitingApps.length}</div>
             </div>
             <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors">
                <Clock className="h-6 w-6" />
             </div>
        </div>
        <div className="p-6 rounded-2xl border bg-card shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-colors">
             <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Totale Mese</p>
                <div className="text-3xl font-bold mt-1 text-foreground">{monthAppsCount}</div>
             </div>
             <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors">
                <Briefcase className="h-6 w-6" />
             </div>
        </div>
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-6">
           <TabsTrigger value="calendar">Calendario</TabsTrigger>
           <TabsTrigger value="list">Lista Completa</TabsTrigger>
        </TabsList>

        {/* --- TAB 1: CALENDARIO --- */}
        <TabsContent value="calendar" className="mt-0">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 h-full">
            
            {/* COLONNA SINISTRA: GRIGLIA */}
            <Card className="border shadow-sm flex flex-col bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b bg-muted/20">
                    <h2 className="text-xl font-bold capitalize text-foreground flex items-center gap-2">
                        {month.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex items-center gap-1 bg-background rounded-md border p-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, -1))}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs font-medium px-3" onClick={() => { setMonth(startOfMonth(new Date())); setSelectedDay(new Date()); }}>
                            Oggi
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, +1))}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                
                <div className="grid grid-cols-7 text-xs font-semibold text-muted-foreground bg-muted/10 border-b">
                    {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => (
                        <div key={d} className="py-3 text-center uppercase tracking-wider">{d}</div>
                    ))}
                </div>
                
                <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y bg-card/40 flex-1 min-h-[600px]">
                    {daysGrid.map((d) => {
                        const inMonth = d.getMonth() === month.getMonth();
                        const isSel = sameDay(d, selectedDay);
                        const isToday = sameDay(d, new Date());
                        const dayApps = monthItems.filter(a => sameDay(new Date(a.starts_at), d));
                        
                        return (
                            <div
                                key={d.toISOString()}
                                onClick={() => setSelectedDay(d)}
                                className={cn(
                                    "p-2 flex flex-col items-start text-left transition-all relative group min-h-[110px] cursor-pointer",
                                    !inMonth ? "bg-muted/10 text-muted-foreground/30" : "hover:bg-muted/30 bg-card",
                                    isSel && "bg-indigo-50/50 ring-inset ring-2 ring-indigo-500 z-10"
                                )}
                            >
                                <div className="flex justify-between w-full mb-1">
                                    <span className={cn(
                                        "text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                                        isToday 
                                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                                            : "text-foreground group-hover:bg-muted"
                                    )}>
                                        {d.getDate()}
                                    </span>
                                </div>
                                
                                <div className="w-full space-y-1.5 mt-1">
                                    {dayApps.slice(0, 4).map(a => {
                                        const config = STATUS_CONFIG[a.status] || STATUS_CONFIG.booked;
                                        const time = new Date(a.starts_at).toLocaleTimeString("it-IT", {hour:'2-digit', minute:'2-digit'});
                                        return (
                                            <div key={a.id} className={cn("text-[10px] px-1.5 py-0.5 rounded-sm truncate w-full border-l-[3px] flex items-center gap-1 font-medium bg-white shadow-sm", config.color)}>
                                                <span className="opacity-70 font-mono tracking-tight">{time}</span>
                                                <span className="truncate">{clienti.find(c => c.id === a.client_id)?.full_name || '...'}</span>
                                            </div>
                                        )
                                    })}
                                    {dayApps.length > 4 && (
                                        <div className="text-[10px] text-muted-foreground pl-1 font-medium bg-muted/50 rounded-full px-2 w-fit">
                                            +{dayApps.length - 4}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* COLONNA DESTRA: DETTAGLIO GIORNO (Modificato come richiesto) */}
            <div className="flex flex-col gap-4 h-full">
                <Card className="border-none shadow-lg shadow-indigo-100/50 h-full flex flex-col">
                    <CardHeader className="py-5 border-b bg-gradient-to-r from-indigo-50 to-white">
                        <CardTitle className="text-lg flex items-center gap-2 text-indigo-900">
                            <Clock className="h-5 w-5 text-indigo-500" />
                            {selectedDay.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-y-auto flex-1 max-h-[calc(100vh-350px)]">
                        <div className="p-4 space-y-4">
                            {monthItems.filter(a => sameDay(new Date(a.starts_at), selectedDay)).length === 0 ? (
                                <div className="text-center py-16 flex flex-col items-center gap-4 text-muted-foreground">
                                    <div className="bg-muted/50 p-6 rounded-full">
                                        <Sparkles className="h-8 w-8 opacity-20" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Nessun impegno.</p>
                                        <p className="text-xs">Goditi il tempo libero o aggiungi un appuntamento.</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)} className="mt-2 border-dashed">
                                        <Plus className="h-3 w-3 mr-2" /> Aggiungi
                                    </Button>
                                </div>
                            ) : (
                                monthItems.filter(a => sameDay(new Date(a.starts_at), selectedDay))
                                .sort((a,b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
                                .map(a => {
                                    const client = clienti.find(c => String(c.id) === String(a.client_id));
                                    const treatment = trattamenti.find(t => String(t.id) === String(a.treatment_id));
                                    const config = STATUS_CONFIG[a.status] || STATUS_CONFIG.booked;

                                    return (
                                        <div key={a.id} className="group relative rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-indigo-200">
                                            {/* Linea colorata laterale */}
                                            <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-r-md", config.color.replace('border-l-', 'bg-'))}></div>
                                            
                                            <div className="pl-3">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-lg text-foreground tabular-nums tracking-tight">
                                                        {new Date(a.starts_at).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}
                                                    </span>
                                                    <Badge variant="secondary" className={cn("text-[10px] font-medium uppercase tracking-wider h-5 px-1.5 rounded-md", config.badge)}>
                                                        {config.label}
                                                    </Badge>
                                                </div>
                                                
                                                <div className="font-semibold text-base mb-0.5 text-foreground">{client?.full_name || 'Cliente sconosciuto'}</div>
                                                
                                                <div className="text-sm text-muted-foreground flex justify-between items-center mt-2 pb-2 border-b border-dashed border-muted">
                                                    <span>{treatment?.name || 'Trattamento'}</span>
                                                    <Badge variant="outline" className="font-semibold text-foreground border-muted bg-muted/20">
                                                        {moneyFromCents(a.final_price_cents)}
                                                    </Badge>
                                                </div>
                                                
                                                {a.notes && (
                                                    <div className="mt-2 text-[10px] text-muted-foreground italic truncate bg-muted/30 p-1.5 rounded">
                                                        "{a.notes}"
                                                    </div>
                                                )}

                                                {/* AZIONI RAPIDE A SCOMPARSA (Restored) */}
                                                <div className="mt-3 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                    {a.status !== 'closed_won' && a.status !== 'closed_lost' && (
                                                        <>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => handleUpdateStatus(a.id, 'closed_won')} title="Esegui">
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600 hover:bg-amber-50 hover:text-amber-700" onClick={() => handleUpdateStatus(a.id, 'closed_lost')} title="Annulla">
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                        </>
                                                    )}
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(a.id)} title="Elimina">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            </div>
        </TabsContent>

        {/* --- TAB 2: LISTA COMPLETA --- */}
        <TabsContent value="list" className="mt-0">
            <Card className="border-none shadow-md">
                <CardHeader className="border-b bg-muted/10 flex flex-row items-center justify-between py-4">
                    <CardTitle className="text-lg">Elenco Completo</CardTitle>
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Cerca cliente o trattamento..." 
                            className="pl-9 bg-background h-9" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                    {filteredListItems.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">Nessun dato trovato.</div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {filteredListItems.map(a => {
                                const config = STATUS_CONFIG[a.status] || STATUS_CONFIG.booked;
                                return (
                                    <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl hover:bg-muted/30 gap-4 transition-colors bg-card hover:border-indigo-200 group">
                                        <div className="flex gap-4 items-center">
                                            <div className="bg-indigo-50 text-indigo-700 font-bold rounded-lg p-3 text-center min-w-[60px] border border-indigo-100">
                                                <div className="text-[10px] uppercase tracking-wider">{new Date(a.starts_at).toLocaleString('it-IT', {month:'short'})}</div>
                                                <div className="text-xl">{new Date(a.starts_at).getDate()}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold flex items-center gap-2 text-lg">
                                                    {clienti.find(c => String(c.id) === String(a.client_id))?.full_name}
                                                </div>
                                                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(a.starts_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                    <span className="text-border mx-1">|</span>
                                                    {trattamenti.find(t => String(t.id) === String(a.treatment_id))?.name}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 justify-between sm:justify-end w-full sm:w-auto">
                                            <div className="flex flex-col items-end gap-1">
                                                <Badge variant="secondary" className={cn("px-2 py-0.5 text-xs", config.badge)}>
                                                    {config.label}
                                                </Badge>
                                                <span className="text-sm font-semibold">{moneyFromCents(a.final_price_cents)}</span>
                                            </div>
                                            
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleDelete(a.id)} className="text-red-600">Elimina</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {/* --- DIALOG PRINCIPALE: NUOVO APPUNTAMENTO --- */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px] gap-0 p-0 overflow-hidden">
           <DialogHeader className="px-6 py-4 bg-gradient-to-r from-pink-50 to-white border-b">
             <DialogTitle className="flex items-center gap-2 text-xl text-blue-900">
               <div className="bg-white p-2 rounded-full shadow-sm"><Plus className="h-5 w-5 text-pink-500" /></div>
               Nuovo Appuntamento
             </DialogTitle>
             <DialogDescription>
               Compila i dettagli per aggiungere un impegno in agenda.
             </DialogDescription>
           </DialogHeader>

           <div className="p-6 space-y-6">
              {/* Riga 1: Cliente (con ricerca) */}
              <div className="space-y-2 relative z-20">
                 <Label>Cliente</Label>
                 <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={inputClientName} 
                      onChange={handleClientNameChange} 
                      placeholder="Cerca nome o scrivi per nuovo..."
                      autoComplete="off"
                      className={cn("pl-9", selectedClientId && "border-emerald-500 ring-emerald-500/20 bg-emerald-50/10")}
                    />
                    {selectedClientId && (
                      <div className="absolute right-3 top-2.5 text-emerald-600 pointer-events-none flex items-center gap-1 text-xs font-medium">
                        <Check className="h-4 w-4" /> Trovato
                      </div>
                    )}
                 </div>
                 {/* Dropdown suggerimenti */}
                 {inputClientName && !selectedClientId && filteredClients.length > 0 && (
                    <div className="absolute w-full bg-popover border rounded-md shadow-xl mt-1 max-h-40 overflow-y-auto z-50">
                      {filteredClients.map(c => (
                        <div key={c.id} className="px-3 py-2 text-sm hover:bg-muted cursor-pointer flex justify-between items-center" onClick={() => selectClient(c)}>
                          <span className="font-medium">{c.full_name}</span>
                          <span className="text-xs text-muted-foreground">{c.phone || '-'}</span>
                        </div>
                      ))}
                    </div>
                 )}
                 {!selectedClientId && inputClientName.length > 2 && filteredClients.length === 0 && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                      <UserPlus className="h-3 w-3" /> Verrà creato un nuovo cliente.
                    </p>
                 )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                 {/* Trattamento */}
                 <div className="space-y-2">
                    <Label>Trattamento</Label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-ring"
                      value={treatmentId}
                      onChange={(e) => setTreatmentId(e.target.value)}
                    >
                      <option value="">Seleziona...</option>
                      {trattamenti.map(t => (
                        <option key={t.id} value={String(t.id)}>{t.name}</option>
                      ))}
                    </select>
                 </div>

                 {/* Prezzo */}
                 <div className="space-y-2">
                    <Label>Prezzo (€)</Label>
                    <Input 
                      value={finalPrice} 
                      onChange={(e) => setFinalPrice(e.target.value)} 
                      placeholder="es. 50" 
                    />
                 </div>
              </div>

              {/* Data e Ora */}
              <div className="space-y-2">
                 <Label>Data e Ora</Label>
                 <Input type="datetime-local" className="w-full" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>

              {/* Note */}
              <div className="space-y-2">
                 <Label>Note <span className="text-muted-foreground font-normal">(opzionale)</span></Label>
                 <Textarea 
                   value={notes} 
                   onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)} 
                   placeholder="Dettagli, preferenze, allergie..." 
                   className="resize-none h-20"
                 />
              </div>
           </div>

           <DialogFooter className="px-6 py-4 bg-muted/20 border-t sm:justify-between items-center">
              <Button variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={loading}>Annulla</Button>
              <Button 
                onClick={onPreCreate} 
                disabled={loading}
                className="bg-pink-200 text-blue-900 hover:bg-pink-300 px-8"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Conferma Prenotazione'}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- ALERT: CLIENTE NON TROVATO --- */}
      <AlertDialog open={showNewClientAlert} onOpenChange={setShowNewClientAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cliente non trovato</AlertDialogTitle>
            <AlertDialogDescription>
              "{inputClientName}" non è presente in rubrica. Vuoi creare una scheda per questo nuovo cliente ora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowNewClientAlert(false)}>No, correggi nome</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowNewClientAlert(false); setShowNewClientForm(true); }}>
              Sì, crea scheda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- FORM: DATI NUOVO CLIENTE --- */}
      <Dialog open={showNewClientForm} onOpenChange={setShowNewClientForm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
               <div className="p-3 bg-blue-100 text-blue-700 rounded-full"><UserPlus className="h-6 w-6" /></div>
               <div>
                 <DialogTitle>Nuovo Cliente</DialogTitle>
                 <DialogDescription>Aggiungi i contatti per <strong>{inputClientName}</strong></DialogDescription>
               </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
               <Label>Telefono <span className="text-red-500">*</span></Label>
               <Input value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} placeholder="es. 333 1234567" autoFocus />
            </div>
            <div className="space-y-2">
               <Label>Email <span className="text-muted-foreground">(opzionale)</span></Label>
               <Input value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="email@esempio.com" />
            </div>
          </div>
          <DialogFooter>
             <Button variant="ghost" onClick={() => setShowNewClientForm(false)}>Annulla</Button>
             <Button onClick={handleCreateClientAndAppointment} disabled={!newClientPhone}>Salva e Continua</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}