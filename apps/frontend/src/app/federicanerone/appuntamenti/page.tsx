'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// --- COSTANTI & HELPER ---

const STATUS_LABEL: Record<AppuntamentoStatus, string> = {
  new_lead: 'Nuovo lead',
  no_answer: 'Nessuna risposta',
  waiting: 'Attesa',
  booked: 'Prenotato',
  closed_won: 'Eseguito',
  closed_lost: 'Perso',
};

function moneyFromCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function fromDatetimeLocalValue(v: string): string {
  return new Date(v).toISOString();
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// --- COMPONENTE PRINCIPALE ---

export default function FedericaAppuntamentiPage() {
  const [tab, setTab] = React.useState<'calendar' | 'list'>('calendar');

  const [items, setItems] = React.useState<Appuntamento[]>([]);
  const [clienti, setClienti] = React.useState<Cliente[]>([]);
  const [trattamenti, setTrattamenti] = React.useState<Trattamento[]>([]);
  
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = React.useState<Date>(() => new Date());

  // Filtri lista
  const [statusFilter, setStatusFilter] = React.useState<AppuntamentoStatus | 'all'>('all');
  const [filterFrom, setFilterFrom] = React.useState('');
  const [filterTo, setFilterTo] = React.useState('');

  // Form Creazione
  const [inputClientName, setInputClientName] = React.useState(''); 
  const [selectedClientId, setSelectedClientId] = React.useState<string | null>(null);
  const [treatmentId, setTreatmentId] = React.useState('');
  const [startsAt, setStartsAt] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [finalPrice, setFinalPrice] = React.useState('');

  // Nuovo Cliente Popup
  const [showNewClientAlert, setShowNewClientAlert] = React.useState(false);
  const [showNewClientForm, setShowNewClientForm] = React.useState(false);
  const [newClientPhone, setNewClientPhone] = React.useState('');
  const [newClientEmail, setNewClientEmail] = React.useState('');

  // --- CARICAMENTO ---

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== 'all') qs.set('status', statusFilter);
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

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, filterFrom, filterTo]);

  React.useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // --- LOGICA FORM ---
  
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
    setError(null);
    if (!treatmentId) return setError('Seleziona un trattamento.');
    if (!startsAt) return setError('Inserisci data e ora.');

    if (selectedClientId) {
      await doCreateAppointment(selectedClientId);
      return;
    }

    if (inputClientName.trim().length > 0) {
      setShowNewClientAlert(true);
    } else {
      setError('Inserisci il nome del cliente.');
    }
  }

  async function doCreateAppointment(cid: string) {
    try {
      setLoading(true);
      const euros = finalPrice.trim();
      const final_price_cents = euros ? Math.round(Number(euros.replace(',', '.')) * 100) : null;

      const body = {
        client_id: cid,
        treatment_id: treatmentId,
        starts_at: fromDatetimeLocalValue(startsAt),
        ends_at: null,
        notes: notes.trim() || null,
        final_price_cents,
        status: 'booked',
      };

      await apiFetch<CreateResponse>('/appuntamenti', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      // Reset
      setInputClientName('');
      setSelectedClientId(null);
      setTreatmentId('');
      setStartsAt('');
      setNotes('');
      setFinalPrice('');

      // Ricarica completa per evitare problemi di stato
      await loadAll(); 

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore creazione appuntamento');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClientAndAppointment() {
    try {
      setLoading(true);
      const resCli = await apiFetch<{ cliente: Cliente }>('/clienti', {
        method: 'POST',
        body: JSON.stringify({
          full_name: inputClientName,
          phone: newClientPhone,
          email: newClientEmail
        })
      });
      
      const newClient = resCli.cliente;
      setClienti(prev => [...prev, newClient]);
      setShowNewClientForm(false);
      setNewClientPhone('');
      setNewClientEmail('');
      await doCreateAppointment(newClient.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore creazione cliente');
      setLoading(false); 
    }
  }

  // Modificato per ricaricare i dati e prevenire la sparizione dell'oggetto
  async function handleUpdateStatus(id: string, next: AppuntamentoStatus) {
    try {
      setLoading(true);
      await apiFetch<UpdateResponse>(`/appuntamenti/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      await loadAll(); // Ricarica tutto per sincronizzare
    } catch (e) { 
      console.error(e); 
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if(!confirm("Eliminare appuntamento?")) return;
    try {
      setLoading(true);
      await apiFetch<{ ok: boolean }>(`/appuntamenti/${id}`, { method: 'DELETE' });
      await loadAll();
    } catch (e) { 
      console.error(e);
      setLoading(false);
    }
  }

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

  // --- RENDER ---

  return (
    <div className="space-y-6 relative">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Appuntamenti</h1>
        <p className="text-sm text-muted-foreground">Gestione agenda e clienti.</p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === 'calendar' ? 'default' : 'outline'} onClick={() => setTab('calendar')}>Calendario</Button>
        <Button variant={tab === 'list' ? 'default' : 'outline'} onClick={() => setTab('list')}>Lista</Button>
        <div className="ml-auto">
          <Button variant="outline" onClick={() => void loadAll()} disabled={loading}>
            {loading ? 'Carico...' : 'Aggiorna'}
          </Button>
        </div>
      </div>

      {/* FORM CREAZIONE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crea appuntamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* 1. Cliente */}
            <div className="space-y-2 relative group">
              <Label>Cliente</Label>
              <Input 
                value={inputClientName} 
                onChange={handleClientNameChange} 
                placeholder="Cerca o inserisci nome..."
                autoComplete="off"
              />
              {inputClientName && !selectedClientId && filteredClients.length > 0 && (
                <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                  {filteredClients.map(c => (
                    <div 
                      key={c.id} 
                      className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                      onClick={() => selectClient(c)}
                    >
                      {c.full_name}
                    </div>
                  ))}
                </div>
              )}
              {selectedClientId && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                   ✓ Cliente selezionato
                   <button onClick={() => { setSelectedClientId(null); setInputClientName(''); }} className="underline text-muted-foreground ml-2">Cambia</button>
                </div>
              )}
            </div>

            {/* 2. Trattamento */}
            <div className="space-y-2">
              <Label>Trattamento</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={treatmentId}
                onChange={(e) => setTreatmentId(e.target.value)}
              >
                <option value="">Seleziona...</option>
                {trattamenti.map(t => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name} ({moneyFromCents(t.price_cents)})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Giorno */}
            <div className="space-y-2">
              <Label>Giorno</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>

            {/* 4. Prezzo */}
            <div className="space-y-2">
              <Label>Prezzo (€)</Label>
              <Input
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                placeholder="es. 50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Note (opzionale)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="..." />
          </div>

          <Button onClick={onPreCreate} disabled={loading}>
            {loading ? 'Creo...' : 'Crea Appuntamento'}
          </Button>
        </CardContent>
      </Card>

      {/* A. Alert Confirmation */}
      <AlertDialog open={showNewClientAlert} onOpenChange={setShowNewClientAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cliente non trovato</AlertDialogTitle>
            <AlertDialogDescription>
              Il cliente "<strong>{inputClientName}</strong>" non esiste nel database. Vuoi aggiungerlo ora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowNewClientAlert(false)}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowNewClientAlert(false); setShowNewClientForm(true); }}>
              Sì, aggiungi cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* B. Form Dati Cliente */}
      <Dialog open={showNewClientForm} onOpenChange={setShowNewClientForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo Cliente: {inputClientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Telefono (opzionale)</Label>
              <Input value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} placeholder="333..." />
            </div>
            <div className="space-y-2">
              <Label>Email (opzionale)</Label>
              <Input value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="email@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClientForm(false)}>Annulla</Button>
            <Button onClick={handleCreateClientAndAppointment} disabled={loading}>
              {loading ? 'Salvataggio...' : 'Salva e Crea Appuntamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- VISTE (CALENDARIO / LISTA) --- */}

      {tab === 'calendar' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">{month.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, -1))}>←</Button>
                <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Oggi</Button>
                <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, +1))}>→</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 text-xs text-muted-foreground mb-1">
                {['L','M','M','G','V','S','D'].map(d => <div key={d} className="px-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 auto-rows-fr">
                {daysGrid.map((d) => {
                  const inMonth = d.getMonth() === month.getMonth();
                  const isSel = sameDay(d, selectedDay);
                  const dayApps = monthItems.filter(a => sameDay(new Date(a.starts_at), d))
                    .sort((a,b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSelectedDay(d)}
                      className={[
                        "flex flex-col items-start justify-start text-left rounded-md border p-1 h-24 overflow-hidden transition",
                        inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground",
                        isSel ? "ring-2 ring-primary border-primary" : "hover:bg-muted"
                      ].join(" ")}
                    >
                      <span className={`text-xs font-semibold mb-1 ${isSel ? 'text-primary' : ''}`}>{d.getDate()}</span>
                      <div className="w-full space-y-1">
                        {dayApps.slice(0, 3).map(a => {
                          let color = "bg-gray-100 text-gray-700 border-gray-200";
                          if(a.status === 'booked') color = "bg-yellow-100 text-yellow-800 border-yellow-200";
                          else if(a.status === 'closed_won') color = "bg-green-100 text-green-800 border-green-200";
                          else if(a.status === 'closed_lost') color = "bg-red-50 text-red-800 opacity-60 line-through";
                          
                          const cName = clienti.find(c => String(c.id) === String(a.client_id))?.full_name || '...';
                          
                          return (
                            <div key={a.id} className={`text-[9px] px-1 py-0.5 rounded border truncate w-full font-medium ${color}`}>
                              {new Date(a.starts_at).toLocaleTimeString("it-IT", {hour:'2-digit', minute:'2-digit'})} {cName}
                            </div>
                          )
                        })}
                        {dayApps.length > 3 && <div className="text-[9px] text-muted-foreground pl-1">+{dayApps.length - 3} altri</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Giorno: {selectedDay.toLocaleDateString('it-IT')}</CardTitle></CardHeader>
            <CardContent>
              {monthItems.filter(a => sameDay(new Date(a.starts_at), selectedDay)).length === 0 ? (
                <div className="text-sm text-muted-foreground">Nessun appuntamento.</div>
              ) : (
                <div className="space-y-2">
                   {monthItems.filter(a => sameDay(new Date(a.starts_at), selectedDay))
                   .sort((a,b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
                   .map(a => (
                     <div key={a.id} className="rounded-md border p-3 bg-card text-card-foreground shadow-sm">
                       <div className="flex justify-between items-start">
                         <div>
                           <div className="font-semibold text-sm">
                             {new Date(a.starts_at).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}
                             {' - '}
                             {clienti.find(c => String(c.id) === String(a.client_id))?.full_name || 'Cliente sconosciuto'}
                           </div>
                           <div className="text-xs text-muted-foreground">
                             {trattamenti.find(t => String(t.id) === String(a.treatment_id))?.name || 'Trattamento'}
                             {' · '}{moneyFromCents(a.final_price_cents)}
                           </div>
                           {a.notes && <div className="text-xs italic mt-1">{a.notes}</div>}
                         </div>
                         <div className="flex flex-col gap-1 items-end">
                            <div className="flex gap-2 items-center mt-2">
                              {/* Mostra Eseguito SOLO se non è già chiuso */}
                              {a.status !== 'closed_won' && (
                                <Button 
                                  variant="default" 
                                  size="sm" 
                                  className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" 
                                  onClick={() => handleUpdateStatus(a.id, 'closed_won')}
                                >
                                  Eseguito
                                </Button>
                              )}
                              
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(a.id)}>
                                Elimina
                              </Button>
                            </div>
                         </div>
                       </div>
                     </div>
                   ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Elenco completo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
             <div className="flex gap-2">
               <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="w-auto" />
               <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="w-auto" />
               <Button onClick={() => void loadAll()} variant="secondary">Filtra</Button>
             </div>
             <div className="space-y-2">
               {items.map(a => (
                 <div key={a.id} className="border p-2 rounded flex justify-between items-center text-sm">
                   <div>
                     <span className="font-bold">{new Date(a.starts_at).toLocaleDateString()} {new Date(a.starts_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                     {' - '}
                     {clienti.find(c => String(c.id) === String(a.client_id))?.full_name}
                   </div>
                   <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground uppercase">{STATUS_LABEL[a.status]}</span>
                      {a.status !== 'closed_won' && (
                        <Button 
                          size="sm" variant="outline" className="h-6 text-[10px] text-green-600 border-green-200 bg-green-50"
                          onClick={() => handleUpdateStatus(a.id, 'closed_won')}
                        >
                          Eseguito
                        </Button>
                      )}
                      <Button 
                        size="sm" variant="ghost" className="h-6 text-[10px] text-red-500"
                        onClick={() => handleDelete(a.id)}
                      >
                        X
                      </Button>
                   </div>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}