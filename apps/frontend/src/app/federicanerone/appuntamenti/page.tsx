'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

function fromDatetimeLocalValue(v: string): string {
  return new Date(v).toISOString();
}

// Helper date per il calendario
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function toYMD(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Stato Calendario
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = React.useState<Date>(() => new Date());

  // Stato Filtri (List View & Fetch)
  const [status, setStatus] = React.useState<AppuntamentoStatus | 'all'>('all');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');

  // Form Creazione
  const [clientId, setClientId] = React.useState('');
  const [treatmentId, setTreatmentId] = React.useState('');
  const [startsAt, setStartsAt] = React.useState('');
  const [endsAt, setEndsAt] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [finalPrice, setFinalPrice] = React.useState('');
  const [createStatus, setCreateStatus] = React.useState<AppuntamentoStatus>('booked');

  // --- Caricamento Dati ---

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams();
      if (status !== 'all') qs.set('status', status);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);

      const url = qs.toString() ? `/appuntamenti?${qs.toString()}` : '/appuntamenti';
      const data = await apiFetch<ListResponse>(url);
      const raw = Array.isArray(data?.appuntamenti) ? data.appuntamenti : [];

      setItems(raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, from, to]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // --- Azioni (Create, Update, Delete) ---

  async function handleCreate() {
    setError(null);

    if (!clientId.trim() || !treatmentId.trim())
      return setError('client_id e treatment_id sono obbligatori.');
    if (!startsAt) return setError('starts_at è obbligatorio.');

    const euros = finalPrice.trim();
    const final_price_cents = euros
      ? Math.round(Number(euros.replace(',', '.')) * 100)
      : null;
    if (euros && Number.isNaN(final_price_cents as any)) return setError('Prezzo non valido.');

    try {
      setLoading(true);

      const body = {
        client_id: clientId.trim(),
        treatment_id: treatmentId.trim(),
        starts_at: fromDatetimeLocalValue(startsAt),
        ends_at: endsAt ? fromDatetimeLocalValue(endsAt) : null,
        notes: notes.trim() || null,
        final_price_cents,
        status: createStatus,
      };

      const data = await apiFetch<CreateResponse>('/appuntamenti', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      // Reset form
      setClientId('');
      setTreatmentId('');
      setStartsAt('');
      setEndsAt('');
      setNotes('');
      setFinalPrice('');
      setCreateStatus('booked');

      // Aggiunge il nuovo elemento in cima
      setItems((prev) => [data.appuntamento, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore creazione');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(id: string, next: AppuntamentoStatus) {
    setError(null);
    try {
      const data = await apiFetch<UpdateResponse>(`/appuntamenti/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      setItems((prev) => prev.map((x) => (x.id === id ? data.appuntamento : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore update');
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await apiFetch<{ ok: boolean }>(`/appuntamenti/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore delete');
    }
  }

  // --- Logica Calendario (Computed) ---

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  // Filtriamo gli elementi caricati per mostrare solo quelli del mese corrente nella vista Calendario
  const monthItems = React.useMemo(() => {
    return items.filter((a) => {
      const s = new Date(a.starts_at).getTime();
      return s >= monthStart.getTime() && s <= monthEnd.getTime();
    });
  }, [items, monthStart, monthEnd]);

  const selectedDayItems = React.useMemo(() => {
    return monthItems
      .filter((a) => sameDay(new Date(a.starts_at), selectedDay))
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [monthItems, selectedDay]);

  const daysGrid = React.useMemo(() => {
    // Generazione griglia (inizia dal lunedì)
    const first = startOfMonth(month);
    const dow = (first.getDay() + 6) % 7; // 0=Mon ... 6=Sun
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

  function countDay(d: Date) {
    return monthItems.filter((a) => sameDay(new Date(a.starts_at), d)).length;
  }

  // --- Render ---

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Appuntamenti</h1>
        <p className="text-sm text-muted-foreground">
          Calendario + lista operativa collegata alle API.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Tabs di navigazione */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'calendar' ? 'default' : 'outline'}
          onClick={() => setTab('calendar')}
        >
          Calendario
        </Button>
        <Button
          variant={tab === 'list' ? 'default' : 'outline'}
          onClick={() => setTab('list')}
        >
          Lista
        </Button>
        <div className="ml-auto">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? 'Carico...' : 'Ricarica'}
          </Button>
        </div>
      </div>

      {/* Form Creazione (sempre visibile) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crea appuntamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>client_id</Label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="es. 1"
              />
            </div>

            <div className="space-y-2">
              <Label>treatment_id</Label>
              <Input
                value={treatmentId}
                onChange={(e) => setTreatmentId(e.target.value)}
                placeholder="es. 2"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={createStatus}
                onChange={(e) => setCreateStatus(e.target.value as AppuntamentoStatus)}
              >
                {Object.keys(STATUS_LABEL).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s as AppuntamentoStatus]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>starts_at</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>ends_at (opzionale)</Label>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Prezzo finale (EUR, opzionale)</Label>
              <Input
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                placeholder="es. 120"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Note (opzionale)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note..."
            />
          </div>

          <Button onClick={() => void handleCreate()} disabled={loading}>
            {loading ? 'Creo...' : 'Crea'}
          </Button>
        </CardContent>
      </Card>

      {/* VISTA CALENDARIO */}
      {tab === 'calendar' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
          {/* Griglia Mese */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">
                {month.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMonth(addMonths(month, -1))}>
                  ←
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMonth(startOfMonth(new Date()))}
                >
                  Oggi
                </Button>
                <Button variant="outline" onClick={() => setMonth(addMonths(month, +1))}>
                  →
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-7 text-xs text-muted-foreground mb-2">
                {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((d) => (
                  <div key={d} className="px-2 py-1">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {daysGrid.map((d) => {
                  const inMonth = d.getMonth() === month.getMonth();
                  const isSel = sameDay(d, selectedDay);
                  const n = countDay(d);

                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSelectedDay(d)}
                      className={[
                        'rounded-md border p-2 text-left hover:bg-muted transition',
                        inMonth ? 'bg-background' : 'bg-muted/40 text-muted-foreground',
                        isSel ? 'ring-2 ring-primary' : '',
                      ].join(' ')}
                      title={toYMD(d)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{d.getDate()}</div>
                        {n > 0 ? (
                          <div className="text-[11px] px-2 py-0.5 rounded-full border">
                            {n}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground truncate">
                        {n > 0 ? 'Appuntamenti' : '—'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Dettaglio Giorno Selezionato */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Giorno: {selectedDay.toLocaleDateString('it-IT')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDayItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nessun appuntamento.</div>
              ) : (
                <div className="space-y-2">
                  {selectedDayItems.map((a) => (
                    <div key={a.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">
                            {new Date(a.starts_at).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {' · '}
                            {STATUS_LABEL[a.status]}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            client_id: <span className="font-mono">{a.client_id}</span> ·
                            treatment_id:{' '}
                            <span className="font-mono">{a.treatment_id}</span> · prezzo:{' '}
                            <span className="font-mono">
                              {moneyFromCents(a.final_price_cents)}
                            </span>
                          </div>
                          {a.notes ? (
                            <div className="text-sm mt-2">{a.notes}</div>
                          ) : null}
                        </div>

                        <div className="flex flex-col gap-2 items-end">
                          <select
                            className="h-9 rounded-md border bg-background px-2 text-sm"
                            value={a.status}
                            onChange={(e) =>
                              void handleUpdateStatus(
                                a.id,
                                e.target.value as AppuntamentoStatus
                              )
                            }
                          >
                            {Object.keys(STATUS_LABEL).map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL[s as AppuntamentoStatus]}
                              </option>
                            ))}
                          </select>

                          <Button
                            variant="outline"
                            className="h-9"
                            onClick={() => void handleDelete(a.id)}
                          >
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
        <>
          {/* VISTA LISTA: Filtri */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtri lista</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-2">
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="all">Tutti gli status</option>
                {Object.keys(STATUS_LABEL).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s as AppuntamentoStatus]}
                  </option>
                ))}
              </select>

              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />

              <Button onClick={() => void load()} disabled={loading}>
                {loading ? 'Carico...' : 'Applica'}
              </Button>
            </CardContent>
          </Card>

          {/* VISTA LISTA: Elenco */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lista ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && items.length === 0 ? (
                <div className="text-sm text-muted-foreground">Caricamento...</div>
              ) : items.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nessun appuntamento.</div>
              ) : (
                <div className="space-y-2">
                  {items
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
                    )
                    .map((a) => (
                      <div key={a.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-1">
                            <div className="font-medium">
                              {STATUS_LABEL[a.status]} ·{' '}
                              {new Date(a.starts_at).toLocaleString('it-IT')}
                              {a.ends_at
                                ? ` → ${new Date(a.ends_at).toLocaleString('it-IT')}`
                                : ''}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              client_id: <span className="font-mono">{a.client_id}</span>{' '}
                              · treatment_id:{' '}
                              <span className="font-mono">{a.treatment_id}</span> ·
                              prezzo:{' '}
                              <span className="font-mono">
                                {moneyFromCents(a.final_price_cents)}
                              </span>
                            </div>

                            {a.notes ? (
                              <div className="text-sm">{a.notes}</div>
                            ) : null}
                          </div>

                          <div className="flex flex-col gap-2 items-end">
                            <div className="text-xs text-muted-foreground">#{a.id}</div>

                            <select
                              className="h-9 rounded-md border bg-background px-2 text-sm"
                              value={a.status}
                              onChange={(e) =>
                                void handleUpdateStatus(
                                  a.id,
                                  e.target.value as AppuntamentoStatus
                                )
                              }
                            >
                              {Object.keys(STATUS_LABEL).map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABEL[s as AppuntamentoStatus]}
                                </option>
                              ))}
                            </select>

                            <Button
                              variant="outline"
                              className="h-9"
                              onClick={() => void handleDelete(a.id)}
                            >
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
        </>
      )}
    </div>
  );
}