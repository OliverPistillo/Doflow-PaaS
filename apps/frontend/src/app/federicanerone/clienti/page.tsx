'use client';

import * as React from 'react';
import Link from 'next/link';
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

type Cliente = {
  id: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export default function ClientiPage() {
  const [items, setItems] = React.useState<Cliente[]>([]);
  const [q, setQ] = React.useState('');

  // create dialog
  const [createOpen, setCreateOpen] = React.useState(false);
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [notes, setNotes] = React.useState('');

  // edit dialog
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Cliente | null>(null);

  async function load() {
    const res = await apiFetch<{ clienti: Cliente[] }>('/api/clienti');
    setItems(Array.isArray(res.clienti) ? res.clienti : []);
  }

  React.useEffect(() => { void load(); }, []);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) =>
      c.full_name.toLowerCase().includes(s) ||
      (c.email ?? '').toLowerCase().includes(s) ||
      (c.phone ?? '').toLowerCase().includes(s),
    );
  }, [items, q]);

  async function createClient() {
    await apiFetch('/api/clienti', {
      method: 'POST',
      body: JSON.stringify({ full_name: fullName, phone, email, notes }),
    });
    setCreateOpen(false);
    setFullName(''); setPhone(''); setEmail(''); setNotes('');
    await load();
  }

  function openEdit(c: Cliente) {
    setEditing(c);
    setFullName(c.full_name ?? '');
    setPhone(c.phone ?? '');
    setEmail(c.email ?? '');
    setNotes(c.notes ?? '');
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editing) return;
    await apiFetch(`/api/clienti/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        full_name: fullName,
        phone,
        email,
        notes,
      }),
    });
    setEditOpen(false);
    setEditing(null);
    setFullName(''); setPhone(''); setEmail(''); setNotes('');
    await load();
  }

  async function deleteClient(id: number) {
    await apiFetch(`/api/clienti/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Clienti</h1>
          <p className="text-sm text-muted-foreground">Gestione clienti (Federica).</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>Nuovo cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuovo cliente</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nome e cognome</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Telefono</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Note</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <Button onClick={createClient} disabled={!fullName.trim()}>
                Crea
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica cliente</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome e cognome</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Telefono</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <Button onClick={saveEdit} disabled={!fullName.trim()}>
              Salva
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Input
        placeholder="Cerca…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground border-b">
          <div className="col-span-5">Nome</div>
          <div className="col-span-3">Telefono</div>
          <div className="col-span-4">Azioni</div>
        </div>

        {filtered.map((c) => (
          <div key={c.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-b last:border-b-0 text-sm">
            <div className="col-span-5">
              <Link
                href={`/federicanerone/clienti/${c.id}`}
                className="font-medium hover:underline"
              >
                {c.full_name}
              </Link>
              <div className="text-xs text-muted-foreground">
                {c.email ?? '—'}
              </div>
            </div>

            <div className="col-span-3 flex items-center">{c.phone ?? '—'}</div>

            <div className="col-span-4 flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                Modifica
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Elimina
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare cliente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se ha appuntamenti collegati, il DB bloccherà l’operazione (ed è giusto così).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteClient(c.id)}>
                      Elimina
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}

        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">Nessun cliente.</div>
        ) : null}
      </div>
    </div>
  );
}
