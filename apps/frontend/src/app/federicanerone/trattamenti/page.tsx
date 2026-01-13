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

type Trattamento = {
  id: number;
  name: string;
  duration_minutes: number;
  price_cents: number;
  category: string | null;
  badge_color: string | null;
  is_active: boolean;
};

function centsToEuro(cents: number | null | undefined) {
  const n = typeof cents === 'number' ? cents : 0;
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n / 100);
}

function euroToCents(input: string) {
  const eur = Number((input ?? '').replace(',', '.'));
  return Number.isFinite(eur) ? Math.round(eur * 100) : 0;
}

export default function TrattamentiPage() {
  const [items, setItems] = React.useState<Trattamento[]>([]);
  const [q, setQ] = React.useState('');

  // create/edit
  const [open, setOpen] = React.useState(false);
  const [isEdit, setIsEdit] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);

  const [name, setName] = React.useState('');
  const [duration, setDuration] = React.useState('60');
  const [priceEuro, setPriceEuro] = React.useState('0');
  const [category, setCategory] = React.useState('');
  const [badgeColor, setBadgeColor] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);

  async function load() {
    const res = await apiFetch<{ trattamenti: Trattamento[] }>('/api/trattamenti');
    setItems(Array.isArray(res.trattamenti) ? res.trattamenti : []);
  }

  React.useEffect(() => { void load(); }, []);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((t) =>
      t.name.toLowerCase().includes(s) ||
      (t.category ?? '').toLowerCase().includes(s),
    );
  }, [items, q]);

  function resetForm() {
    setName('');
    setDuration('60');
    setPriceEuro('0');
    setCategory('');
    setBadgeColor('');
    setIsActive(true);
    setIsEdit(false);
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(t: Trattamento) {
    setIsEdit(true);
    setEditingId(t.id);
    setName(t.name ?? '');
    setDuration(String(t.duration_minutes ?? 60));
    setPriceEuro(String((t.price_cents / 100).toFixed(2)).replace('.', ','));
    setCategory(t.category ?? '');
    setBadgeColor(t.badge_color ?? '');
    setIsActive(Boolean(t.is_active));
    setOpen(true);
  }

  async function save() {
    const dur = parseInt(duration, 10);
    const payload = {
      name,
      duration_minutes: Number.isFinite(dur) ? dur : 60,
      price_cents: euroToCents(priceEuro),
      category: category.trim() || null,
      badge_color: badgeColor.trim() || null,
      is_active: isActive,
    };

    if (!name.trim()) return;

    if (isEdit && editingId) {
      await apiFetch(`/api/trattamenti/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/trattamenti', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    setOpen(false);
    resetForm();
    await load();
  }

  async function remove(id: number) {
    await apiFetch(`/api/trattamenti/${id}`, { method: 'DELETE' });
    await load();
  }

  async function toggleActive(t: Trattamento) {
    await apiFetch(`/api/trattamenti/${t.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !t.is_active }),
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Trattamenti</h1>
          <p className="text-sm text-muted-foreground">CRUD trattamenti (Federica).</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>Nuovo trattamento</Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEdit ? 'Modifica trattamento' : 'Nuovo trattamento'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Durata (min)</Label>
                  <Input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" />
                </div>
                <div className="space-y-1">
                  <Label>Prezzo (€)</Label>
                  <Input value={priceEuro} onChange={(e) => setPriceEuro(e.target.value)} inputMode="decimal" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Badge color (opz.)</Label>
                  <Input value={badgeColor} onChange={(e) => setBadgeColor(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <Label htmlFor="active">Attivo</Label>
              </div>

              <Button onClick={save} disabled={!name.trim()}>
                Salva
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground border-b">
          <div className="col-span-5">Nome</div>
          <div className="col-span-2">Durata</div>
          <div className="col-span-2">Prezzo</div>
          <div className="col-span-3 text-right">Azioni</div>
        </div>

        {filtered.map((t) => (
          <div key={t.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-b last:border-b-0 text-sm">
            <div className="col-span-5">
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                {t.category ?? '—'}{t.badge_color ? ` · ${t.badge_color}` : ''}
              </div>
            </div>

            <div className="col-span-2 flex items-center">{t.duration_minutes} min</div>
            <div className="col-span-2 flex items-center">{centsToEuro(t.price_cents)}</div>

            <div className="col-span-3 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleActive(t)}>
                {t.is_active ? 'Attivo' : 'Off'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                Modifica
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">Elimina</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare trattamento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se ci sono appuntamenti collegati, il DB bloccherà l’eliminazione.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(t.id)}>Elimina</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}

        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">Nessun trattamento.</div>
        ) : null}
      </div>
    </div>
  );
}
