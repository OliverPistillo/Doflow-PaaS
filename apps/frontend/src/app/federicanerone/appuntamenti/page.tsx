'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Calendar as CalendarIcon, List, RefreshCw, Plus, Check, X, Trash2, Clock, UserPlus } from 'lucide-react';
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

const STATUS_CONFIG: Record<AppuntamentoStatus, { label: string, color: string }> = {
  new_lead: { label: 'Nuovo Lead', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  no_answer: { label: 'No Risposta', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  waiting: { label: 'Attesa', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  booked: { label: 'Prenotato', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  closed_won: { label: 'Eseguito', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed_lost: { label: 'Annullato', color: 'bg-red-50 text-red-700 border-red-200 line-through opacity-70' },
};

function moneyFromCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

function fromDatetimeLocalValue(v: string): string {
  return new Date(v).toISOString();
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function FedericaAppuntamentiPage() {
  const [tab, setTab] = React.useState<'calendar' | 'list'>('calendar');
  const [items, setItems] = React.useState<Appuntamento[]>([]);
  const [clienti, setClienti] = React.useState<Cliente[]>([]);
  const [trattamenti, setTrattamenti] = React.useState<Trattamento[]>([]);
  const [loading, setLoading] = React.useState(false);
  
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = React.useState<Date>(() => new Date());

  // Filters
  const [filterFrom, setFilterFrom] = React.useState('');
  const [filterTo, setFilterTo] = React.useState('');

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

  // FORM HANDLERS
  const filteredClients = React.useMemo(() => {
    if (!inputClientName) return [];
    return clienti.filter(c => c.full_name.toLowerCase().includes(inputClientName.toLowerCase()));
  }, [clienti, inputClientName]);

  const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputClientName(e.target.value);
    const match = clienti.find(c => c.full_name.toLowerCase() === e.target.value.toLowerCase());
    setSelectedClientId(match ? match.id : null);
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
    
    // Caso 1: Cliente Esistente Selezionato -> Crea subito
    if (selectedClientId) { 
      await doCreateAppointment(selectedClientId); 
      return; 
    }

    // Caso 2: Nome inserito ma nessun ID (Cliente Nuovo?)
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
      
      // Reset Form
      setInputClientName(''); setSelectedClientId(null); setTreatmentId(''); 
      setStartsAt(''); setNotes(''); setFinalPrice('');
      
      await loadAll(); 
    } catch (e) { alert('Errore creazione'); } finally { setLoading(false); }
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
    } catch (e) { alert('Errore creazione cliente'); setLoading(false); }
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

  return (
    <div className="min-h-screen bg-transparent space-y-8 pb-20">
      
      {/* HEADER PAGE */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Appuntamenti</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Gestisci l'agenda, prenota nuovi clienti e monitora lo stato dei lavori.
          </p>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex bg-muted p-1 rounded-lg">
             <Button variant={tab === 'calendar' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('calendar')} className="shadow-none">
                <CalendarIcon className="mr-2 h-4 w-4" /> Calendario
             </Button>
             <Button variant={tab === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('list')} className="shadow-none">
                <List className="mr-2 h-4 w-4" /> Lista
             </Button>
           </div>
           <Button variant="outline" size="icon" onClick={() => void loadAll()} disabled={loading}>
             <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
           </Button>
        </div>
      </div>

      {/* --- FORM RAPIDO (Sempre visibile per comodità) --- */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
         <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
           <Plus className="h-5 w-5 text-primary" /> Nuovo Appuntamento
         </h3>
         <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
            
            {/* Input Cliente con Autocomplete */}
            <div className="lg:col-span-1 space-y-2 relative">
               <Label>Cliente</Label>
               <div className="relative">
                 <Input 
                   value={inputClientName} 
                   onChange={handleClientNameChange} 
                   placeholder="Cerca nome..."
                   autoComplete="off"
                   className={cn(selectedClientId && "border-emerald-500 ring-emerald-500/20 pr-8")}
                 />
                 {selectedClientId && (
                   <div className="absolute right-2 top-2.5 text-emerald-600 pointer-events-none">
                     <Check className="h-4 w-4" />
                   </div>
                 )}
               </div>
               {/* Dropdown suggerimenti */}
               {inputClientName && !selectedClientId && filteredClients.length > 0 && (
                  <div className="absolute z-10 w-full bg-popover border rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                    {filteredClients.map(c => (
                      <div key={c.id} className="px-3 py-2 text-sm hover:bg-muted cursor-pointer" onClick={() => selectClient(c)}>
                        {c.full_name}
                      </div>
                    ))}
                  </div>
               )}
            </div>

            {/* Input Trattamento */}
            <div className="lg:col-span-1 space-y-2">
               <Label>Trattamento</Label>
               <select
                 className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                 value={treatmentId}
                 onChange={(e) => setTreatmentId(e.target.value)}
               >
                 <option value="">Seleziona...</option>
                 {trattamenti.map(t => (
                   <option key={t.id} value={String(t.id)}>{t.name}</option>
                 ))}
               </select>
            </div>

            {/* Input Data */}
            <div className="lg:col-span-1 space-y-2">
               <Label>Data & Ora</Label>
               <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>

            {/* Bottone Conferma */}
            <div className="lg:col-span-1">
               <Button onClick={onPreCreate} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                 {loading ? '...' : 'Conferma Prenotazione'}
               </Button>
            </div>
         </div>
         
         {/* -- REINSERIMENTO CAMPO NOTE -- */}
         <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-4 space-y-2">
               <Label>Note (opzionale)</Label>
               <Input 
                 value={notes} 
                 onChange={(e) => setNotes(e.target.value)} 
                 placeholder="Dettagli aggiuntivi, preferenze..." 
               />
            </div>
         </div>
      </div>

      {/* --- VISTA CALENDARIO --- */}
      {tab === 'calendar' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
          <Card className="overflow-hidden border-none shadow-none bg-transparent">
             {/* Header Calendario */}
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-xl font-bold capitalize text-foreground">
                 {month.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
               </h2>
               <div className="flex gap-1">
                 <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, -1))}>←</Button>
                 <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Oggi</Button>
                 <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, +1))}>→</Button>
               </div>
             </div>
             
             {/* Griglia */}
             <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 text-xs font-medium text-muted-foreground bg-muted/30 border-b">
                  {['L','M','M','G','V','S','D'].map(d => <div key={d} className="py-2 text-center">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y bg-card">
                  {daysGrid.map((d) => {
                    const inMonth = d.getMonth() === month.getMonth();
                    const isSel = sameDay(d, selectedDay);
                    const isToday = sameDay(d, new Date());
                    const dayApps = monthItems.filter(a => sameDay(new Date(a.starts_at), d));
                    
                    return (
                      <button
                        key={d.toISOString()}
                        onClick={() => setSelectedDay(d)}
                        className={cn(
                          "min-h-[100px] p-2 flex flex-col items-start text-left transition-colors hover:bg-muted/40 relative",
                          !inMonth && "bg-muted/10 text-muted-foreground/50",
                          isSel && "bg-primary/5 ring-inset ring-2 ring-primary z-10"
                        )}
                      >
                        <span className={cn(
                          "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1",
                          isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                        )}>
                          {d.getDate()}
                        </span>
                        
                        <div className="w-full space-y-1 mt-1">
                          {dayApps.slice(0, 3).map(a => {
                             const config = STATUS_CONFIG[a.status] || STATUS_CONFIG.booked;
                             const cName = clienti.find(c => String(c.id) === String(a.client_id))?.full_name.split(' ')[0] || '...';
                             return (
                               <div key={a.id} className={cn("text-[10px] px-1.5 py-0.5 rounded-sm truncate w-full border", config.color)}>
                                 {new Date(a.starts_at).toLocaleTimeString("it-IT", {hour:'2-digit', minute:'2-digit'})} {cName}
                               </div>
                             )
                          })}
                          {dayApps.length > 3 && (
                             <div className="text-[9px] text-muted-foreground pl-1 font-medium">+{dayApps.length - 3} altri</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
             </div>
          </Card>

          {/* Dettaglio Giorno Laterale */}
          <div className="space-y-4">
             <h3 className="font-semibold text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                {selectedDay.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
             </h3>
             
             <div className="space-y-3">
                {monthItems.filter(a => sameDay(new Date(a.starts_at), selectedDay))
                   .sort((a,b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
                   .map(a => {
                      const client = clienti.find(c => String(c.id) === String(a.client_id));
                      const treatment = trattamenti.find(t => String(t.id) === String(a.treatment_id));
                      const config = STATUS_CONFIG[a.status] || STATUS_CONFIG.booked;

                      return (
                        <div key={a.id} className="group relative rounded-xl border bg-card p-4 hover:shadow-md transition-all">
                           <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-lg text-foreground">
                                {new Date(a.starts_at).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}
                              </span>
                              <Badge variant="outline" className={cn("text-[10px] px-2 py-0 h-5 border-0 font-normal", config.color)}>
                                {config.label}
                              </Badge>
                           </div>
                           
                           <div className="font-medium text-base mb-1">{client?.full_name || 'Cliente sconosciuto'}</div>
                           <div className="text-sm text-muted-foreground flex justify-between">
                              <span>{treatment?.name || 'Trattamento'}</span>
                              <span className="font-semibold text-foreground">{moneyFromCents(a.final_price_cents)}</span>
                           </div>
                           
                           {a.notes && (
                             <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                               Note: {a.notes}
                             </div>
                           )}

                           {/* Azioni Rapide (Hover) */}
                           <div className="mt-4 pt-3 border-t flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              {a.status !== 'closed_won' && a.status !== 'closed_lost' && (
                                <>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleUpdateStatus(a.id, 'closed_won')} title="Esegui">
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-slate-700" onClick={() => handleUpdateStatus(a.id, 'closed_lost')} title="Annulla">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(a.id)} title="Elimina">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                           </div>
                        </div>
                      )
                   })}
                   
                {monthItems.filter(a => sameDay(new Date(a.starts_at), selectedDay)).length === 0 && (
                   <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground bg-muted/10">
                      Nessun impegno per oggi.
                   </div>
                )}
             </div>
          </div>
        </div>
      ) : (
        /* --- VISTA LISTA --- */
        <Card>
          <CardHeader><CardTitle>Elenco Completo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
             {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nessun dato trovato.</div>
             ) : (
                <div className="space-y-2">
                   {items.map(a => {
                      const config = STATUS_CONFIG[a.status] || STATUS_CONFIG.booked;
                      return (
                        <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:bg-muted/50 gap-3">
                           <div>
                              <div className="font-semibold flex items-center gap-2">
                                 {new Date(a.starts_at).toLocaleDateString()} {new Date(a.starts_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                 <Badge variant="secondary" className={cn("text-[10px] px-1.5 h-5 font-normal", config.color)}>{config.label}</Badge>
                              </div>
                              <div className="text-sm">
                                 {clienti.find(c => String(c.id) === String(a.client_id))?.full_name} 
                                 <span className="text-muted-foreground mx-1">•</span> 
                                 {trattamenti.find(t => String(t.id) === String(a.treatment_id))?.name}
                              </div>
                           </div>
                           <div className="flex gap-2 justify-end">
                              {a.status === 'booked' && (
                                 <Button size="sm" variant="outline" className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50" onClick={() => handleUpdateStatus(a.id, 'closed_won')}>Esegui</Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4" /></Button>
                           </div>
                        </div>
                      )
                   })}
                </div>
             )}
          </CardContent>
        </Card>
      )}

      {/* --- DIALOGHI NASCOSTI (Gestione Nuovo Cliente) --- */}
      
      {/* 1. Alert: "Cliente non trovato, vuoi crearlo?" */}
      <AlertDialog open={showNewClientAlert} onOpenChange={setShowNewClientAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cliente non trovato</AlertDialogTitle>
            <AlertDialogDescription>
              "{inputClientName}" non è presente in rubrica. Vuoi creare una scheda per questo nuovo cliente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowNewClientAlert(false)}>No</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowNewClientAlert(false); setShowNewClientForm(true); }}>
              Sì, crea scheda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 2. Form: Dati Nuovo Cliente (Telefono/Email) */}
      <Dialog open={showNewClientForm} onOpenChange={setShowNewClientForm}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
               <div className="p-2 bg-primary/10 rounded-full"><UserPlus className="h-5 w-5 text-primary" /></div>
               <DialogTitle>Nuovo Cliente: {inputClientName}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
               <Label>Telefono</Label>
               <Input value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} placeholder="es. 333 1234567" />
            </div>
            <div className="space-y-2">
               <Label>Email (opzionale)</Label>
               <Input value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="email@esempio.com" />
            </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setShowNewClientForm(false)}>Annulla</Button>
             <Button onClick={handleCreateClientAndAppointment}>Salva e Prenota</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}