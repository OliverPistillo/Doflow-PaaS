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

// Tipi per Clienti e Trattamenti
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
  closed_won: 'Chiuso',
  closed_lost: 'Perso',
};

function moneyFromCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function toDatetimeLocalValue(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  // Dati principali
  const [items, setItems] = React.useState<Appuntamento[]>([]);
  const [clienti, setClienti] = React.useState<Cliente[]>([]);
  const [trattamenti, setTrattamenti] = React.useState<Trattamento[]>([]);
  
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Stati per il calendario
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = React.useState<Date>(() => new Date());

  // Stati per i filtri lista
  const [statusFilter, setStatusFilter] = React.useState<AppuntamentoStatus | 'all'>('all');
  const [filterFrom, setFilterFrom] = React.useState('');
  const [filterTo, setFilterTo] = React.useState('');

  // --- FORM CREAZIONE APPUNTAMENTO ---
  const [inputClientName, setInputClientName] = React.useState(''); // Quello che l'utente scrive
  const [selectedClientId, setSelectedClientId] = React.useState<string | null>(null);
  
  const [treatmentId, setTreatmentId] = React.useState('');
  const [startsAt, setStartsAt] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [finalPrice, setFinalPrice] = React.useState(''); // euro string

  // Stati per gestione "Nuovo Cliente"
  const [showNewClientAlert, setShowNewClientAlert] = React.useState(false);
  const [showNewClientForm, setShowNewClientForm] = React.useState(false);
  // Dati form nuovo cliente
  const [newClientPhone, setNewClientPhone] = React.useState('');
  const [newClientEmail, setNewClientEmail] = React.useState('');

  // --- CARICAMENTO DATI ---

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Carica Appuntamenti
      const qs = new URLSearchParams();
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (filterFrom) qs.set('from', filterFrom);
      if (filterTo) qs.set('to', filterTo);
      
      const p1 = apiFetch<ListResponse>(`/appuntamenti?${qs.toString()}`);
      // 2. Carica dati ausiliari (se non già caricati, o ricarica sempre per sicurezza)
      const p2 = apiFetch<{ clienti: Cliente[] }>('/clienti');
      const p3 = apiFetch<{ trattamenti: Trattamento[] }>('/trattamenti');

      const [resApp, resCli, resTrat] = await Promise.all([p1, p2, p3]);

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

  // --- LOGICA AUTOCOMPLETE CLIENTE ---
  
  // Filtra clienti mentre si scrive
  const filteredClients = React.useMemo(() => {
    if (!inputClientName) return [];
    return clienti.filter(c => c.full_name.toLowerCase().includes(inputClientName.toLowerCase()));
  }, [clienti, inputClientName]);

  const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputClientName(e.target.value);
    // Se l'utente digita, resettiamo l'ID selezionato finché non clicca su un suggerimento
    // Oppure controlliamo match esatto
    const match = clienti.find(c => c.full_name.toLowerCase() === e.target.value.toLowerCase());
    setSelectedClientId(match ? match.id : null);
  };

  const selectClient = (c: Cliente) => {
    setInputClientName(c.full_name);
    setSelectedClientId(c.id);
  };

  // Quando seleziono un trattamento, imposta il prezzo di default se vuoto
  React.useEffect(() => {
    if (treatmentId && !finalPrice) {
      const t = trattamenti.find(x => String(x.id) === treatmentId);
      if (t) {
        setFinalPrice(String(t.price_cents / 100));
      }
    }
  }, [treatmentId, trattamenti, finalPrice]);


  // --- CREAZIONE ---

  // 1. Click su "Crea"
  async function onPreCreate() {
    setError(null);
    if (!treatmentId) return setError('Seleziona un trattamento.');
    if (!startsAt) return setError('Inserisci data e ora.');

    // Caso A: Cliente esistente selezionato o match esatto trovato
    if (selectedClientId) {
      await doCreateAppointment(selectedClientId);
      return;
    }

    // Caso B: Nessun ID, ma c'è un nome scritto -> Nuovo Cliente?
    if (inputClientName.trim().length > 0) {
      setShowNewClientAlert(true); // "Vuoi creare il cliente?"
    } else {
      setError('Inserisci il nome del cliente.');
    }
  }

  // 2. Creazione effettiva Appuntamento
  async function doCreateAppointment(cid: string) {
    try {
      setLoading(true);
      const euros = finalPrice.trim();
      const final_price_cents = euros ? Math.round(Number(euros.replace(',', '.')) * 100) : null;

      const body = {
        client_id: cid,
        treatment_id: treatmentId,
        starts_at: fromDatetimeLocalValue(startsAt),
        ends_at: null, // Calcolato dal backend o null
        notes: notes.trim() || null,
        final_price_cents,
        status: 'booked', // Default status
      };

      const data = await apiFetch<CreateResponse>('/appuntamenti', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      // Reset Form
      setInputClientName('');
      setSelectedClientId(null);
      setTreatmentId('');
      setStartsAt('');
      setNotes('');
      setFinalPrice('');

      // Aggiungi alla lista
      setItems((prev) => [data.appuntamento, ...prev]);
      // Ricarica per sicurezza (aggiorna calendari etc)
      void loadAll(); 

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore creazione appuntamento');
    } finally {
      setLoading(false);
    }
  }

  // 3. Creazione Nuovo Cliente (Flow Popup)
  async function handleCreateClientAndAppointment() {
    try {
      setLoading(true);
      // Crea Cliente
      const resCli = await apiFetch<{ cliente: Cliente }>('/clienti', {
        method: 'POST',
        body: JSON.stringify({
          full_name: inputClientName,
          phone: newClientPhone,
          email: newClientEmail
        })
      });
      
      const newClient = resCli.cliente;
      // Aggiorna lista locale clienti
      setClienti(prev => [...prev, newClient]);
      
      // Chiudi form e procedi a creare appuntamento con il nuovo ID
      setShowNewClientForm(false);
      setNewClientPhone('');
      setNewClientEmail('');
      
      await doCreateAppointment(newClient.id);

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore creazione cliente');
      setLoading(false); // Stop loading solo se errore, altrimenti continua in doCreateAppointment
    }
  }

  // --- UPDATE / DELETE (Come prima) ---

  async function handleUpdateStatus(id: string, next: AppuntamentoStatus) {
    try {
      const data = await apiFetch<UpdateResponse>(`/appuntamenti/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      setItems((prev) => prev.map((x) => (x.id === id ? data.appuntamento : x)));
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id: string) {
    if(!confirm("Eliminare appuntamento?")) return;
    try {
      await apiFetch<{ ok: boolean }>(`/appuntamenti/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) { console.error(e); }
  }

  // --- CALENDAR COMPUTED ---
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

      {/* FORM CREAZIONE (Rinnovato) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crea appuntamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* 1. Cliente (Autocomplete) */}
            <div className="space-y-2 relative group">
              <Label>Cliente</Label>
              <Input 
                value={inputClientName} 
                onChange={handleClientNameChange} 
                placeholder="Cerca o inserisci nome..."
                autoComplete="off"
              />
              {/* Dropdown suggerimenti */}
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

            {/* 2. Trattamento (Select) */}
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

            {/* 3. Giorno (Data e Ora) */}
            <div className="space-y-2">
              <Label>Data e Ora</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>

            {/* 4. Prezzo (Rinominato) */}
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

      {/* --- POPUPs NUOVO CLIENTE --- */}
      
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
          {/* Mese */}
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
                          let color = "bg-gray-100 text-gray-700";
                          if(a.status === 'booked') color = "bg-green-100 text-green-800 border-green-200";
                          else if(a.status === 'closed_lost') color = "bg-red-50 text-red-800 opacity-60 line-through";
                          
                          // Cerchiamo nome cliente
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

          {/* Dettaglio Giorno */}
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
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground mb-1">
                              {STATUS_LABEL[a.status]}
                            </span>
                            <Button variant="ghost" size="sm" className="h-6 text-xs text-red-500" onClick={() => handleDelete(a.id)}>
                              Elimina
                            </Button>
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
        /* VISTA LISTA (Semplificata) */
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
                   <div className="text-xs text-muted-foreground">{STATUS_LABEL[a.status]}</div>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}