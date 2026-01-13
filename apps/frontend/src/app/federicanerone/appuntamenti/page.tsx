'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Cliente = { id: number; full_name: string };
type Trattamento = { id: number; name: string; price_cents: number; duration_minutes: number; is_active?: boolean };

type Appuntamento = {
  id: number;
  client_id: number;
  client_name: string;
  treatment_id: number;
  treatment_name: string;
  starts_at: string;
  ends_at: string | null;
  final_price_cents: number | null;
  notes: string | null;
  status: string;
};

function centsToEuro(cents: number | null | undefined) {
  const n = typeof cents === 'number' ? cents : 0;
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n / 100);
}

function euroToCents(input: string) {
  const eur = Number((input ?? '').replace(',', '.'));
  return Number.isFinite(eur) ? Math.round(eur * 100) : null;
}

function toLocalDatetimeInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AppuntamentiPage() {
  const [items, setItems] = React.useState<Appuntamento[]>([]);
  const [clienti, setClienti] = React.useState<Cliente[]>([]);
  const [trattamenti, setTrattamenti] = React.useState<Trattamento[]>([]);
  const [q, setQ] = React.useState('');

  const [open, setOpen] = React.useState(false);
  const [isEdit, setIsEdit] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);

  // form
  const [clientId, setClientId] = React.useState<string>('');
  const [treatmentId, setTreatmentId] = React.useState<string>('');
  const [startsAt, setStartsAt] = React.useState<string>(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return toLocalDatetimeInputValue(d.toISOString());
  });
  const [finalPriceEuro, setFinalPriceEuro] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');
  const [status, setStatus] = React.useState<string>('booked');

  async function loadAll() {
    const [a, c, t] = await Promise.all([
      apiFetch<{ appuntamenti: Appuntamento[] }>('/api/appuntamenti'),
      apiFetch<{ clienti: Cliente[] }>('/api/clienti'),
      apiFetch<{ trattamenti: Trattamento[] }>('/api/trattamenti'),
    ]);

    setItems(Array.isArray(a.appuntamenti) ? a.appuntamenti : []);
    setClienti(Array.isArray(c.clienti) ? c.clienti : []);
    setTrattamenti(Array.isArray(t.trattamenti) ? t.trattamenti : []);
  }

  React.useEffect(() => { void loadAll(); }, []);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((a) =>
      a.client_name.toLowerCase().includes(s) ||
      a.treatment_name.toLowerCase().includes(s) ||
      (a.status ?? '').toLowerCase().includes(s),
    );
  }, [items, q]);

  const selectedTreatment = React.useMemo(() => {
    const id = Number(treatmentId);
    if (!id) return null;
    return trattamenti.find((t) => t.id === id) ?? null;
  }, [treatmentId, trattamenti]);

  React.useEffect(() => {
    if (selectedTreatment && !finalPriceEuro.trim()) {
      setFinalPriceEuro(String((selectedTreatment.price_cents / 100).toFixed(2)).replace('.', ','));
    }
  }, [selectedTreatment, finalPriceEuro]);

  function resetForm() {
    setClientId('');
    setTreatmentId('');
    setNotes('');
    setStatus('booked');
    setFinalPriceEuro('');
    const d = new Date(Date.now() + 30 * 60 * 1000);
    setStartsAt(toLocalDatetimeInputValue(d.toISOString()));
    setIsEdit(false);
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEditRow(a: Appuntamento) {
    setIsEdit(true);
    setEditingId(a.id);
    setClientId(String(a.client_id));
    setTreatmentId(String(a.treatment_id));
    setStartsAt(toLocalDatetimeInputValue(a.starts_at));
    setFinalPriceEuro(
      a.final_price_cents != null
        ? String((a.final_price_cents / 100).toFixed(2)).replace('.', ',')
        : ''
    );
    setNotes(a.notes ?? '');
    setStatus(a.status ?? 'booked');
    setOpen(true);
  }

  async function save() {
    const cid = Number(clientId);
    const tid = Number(treatmentId);
    if (!cid || !tid) return;

    const startsIso = new Date(startsAt).toISOString();

    const payload = {
      client_id: cid,
      treatment_id: tid,
      starts_at: startsIso,
      final_price_cents: euroToCents(finalPriceEuro),
      notes: notes.trim() || null,
      status,
    };

    if (isEdit && editingId) {
      await apiFetch(`/api/appuntamenti/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/appuntamenti', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    setOpen(false);
    resetForm();
    await loadAll();
  }

  async function remove(id: number) {
    await apiFetch(`/api/appuntamenti/${id}`, { method: 'DELETE' });
    await loadAll();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Appuntamenti</h1>
          <p className="text-sm text-muted-foreground">
            Cliente + trattamento + data/ora + prezzo + note.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>Nuovo appuntamento</Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEdit ? 'Modifica appuntamento' : 'Nuovo appuntamento'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Cliente</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  >
                    <option value="">Seleziona…</option>
                    {clienti.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>Trattamento</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={treatmentId}
                    onChange={(e) => setTreatmentId(e.target.value)}
                  >
                    <option value="">Seleziona…</option>
                    {trattamenti
                      .filter((t) => t.is_active !== false)
                      .map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Inizio</Label>
                  <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>

                <div className="space-y-1">
                  <Label>Prezzo finale (€)</Label>
                  <Input value={finalPriceEuro} onChange={(e) => setFinalPriceEuro(e.target.value)} inputMode="decimal" />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Stato</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="booked">Prenotato</option>
                  <option value="done">Eseguito</option>
                  <option value="cancelled">Annullato</option>
                  <option value="no_show">No-show</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label>Note</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <Button onClick={save} disabled={!clientId || !treatmentId || !startsAt}>
                Salva
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Input placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Button variant="outline" onClick={loadAll}>Aggiorna</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground border-b">
          <div className="col-span-4">Cliente</div>
          <div className="col-span-3">Trattamento</div>
          <div className="col-span-3">Data/Ora</div>
          <div className="col-span-2 text-right">Azioni</div>
        </div>

        {filtered.map((a) => (
          <div key={a.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-b last:border-b-0 text-sm">
            <div className="col-span-4">
              <div className="font-medium">{a.client_name}</div>
              <div className="text-xs text-muted-foreground">{a.status}</div>
            </div>

            <div className="col-span-3 flex items-center">{a.treatment_name}</div>

            <div className="col-span-3 flex items-center">
              {new Date(a.starts_at).toLocaleString('it-IT')}
            </div>

            <div className="col-span-2 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => openEditRow(a)}>
                Modifica
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">Elimina</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare appuntamento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Operazione irreversibile. (Sì, lo so: anche la vita.)
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(a.id)}>
                      Elimina
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="text-xs text-muted-foreground pl-2">
                {centsToEuro(a.final_price_cents)}
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">Nessun appuntamento.</div>
        ) : null}
      </div>
    </div>
  );
}
