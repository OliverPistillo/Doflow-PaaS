'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function ClienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number((params as any).id);

  const [cliente, setCliente] = React.useState<Cliente | null>(null);
  const [storico, setStorico] = React.useState<Appuntamento[]>([]);
  const [loading, setLoading] = React.useState(true);

  // edit fields
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [notes, setNotes] = React.useState('');

  async function load() {
    setLoading(true);
    try {
      const [cRes, aRes] = await Promise.all([
        apiFetch<{ clienti: Cliente[] }>('/api/clienti'),
        apiFetch<{ appuntamenti: Appuntamento[] }>('/api/appuntamenti'),
      ]);

      const found = (cRes.clienti ?? []).find((c) => Number(c.id) === id) ?? null;
      setCliente(found);

      if (found) {
        setFullName(found.full_name ?? '');
        setPhone(found.phone ?? '');
        setEmail(found.email ?? '');
        setNotes(found.notes ?? '');
      }

      const all = Array.isArray(aRes.appuntamenti) ? aRes.appuntamenti : [];
      const mine = all.filter((a) => Number(a.client_id) === id);
      setStorico(mine);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!Number.isFinite(id) || !id) {
      router.push('/federicanerone/clienti');
      return;
    }
    void load();
  }, [id, router]);

  async function save() {
    if (!cliente) return;
    await apiFetch(`/api/clienti/${cliente.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        full_name: fullName,
        phone,
        email,
        notes,
      }),
    });
    await load();
  }

  async function remove() {
    if (!cliente) return;
    await apiFetch(`/api/clienti/${cliente.id}`, { method: 'DELETE' });
    router.push('/federicanerone/clienti');
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Caricamento…</div>;
  }

  if (!cliente) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">Cliente non trovato.</div>
        <Button variant="outline" onClick={() => router.push('/federicanerone/clienti')}>
          Torna ai clienti
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-muted-foreground">
            <Link href="/federicanerone/clienti" className="hover:underline">Clienti</Link>
            <span> / </span>
            <span>{cliente.full_name}</span>
          </div>
          <h1 className="text-xl font-semibold">{cliente.full_name}</h1>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Elimina cliente</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                Se ci sono appuntamenti collegati, l’eliminazione verrà bloccata.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>Elimina</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Anagrafica */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">Anagrafica</h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Nome e cognome</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Telefono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Note</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <Button onClick={save} disabled={!fullName.trim()}>
          Salva modifiche
        </Button>
      </div>

      {/* Storico */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-medium">Storico appuntamenti</h2>
          <p className="text-xs text-muted-foreground">
            {storico.length} appuntamenti trovati
          </p>
        </div>

        {storico.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">Nessun appuntamento.</div>
        ) : (
          storico.map((a) => (
            <div key={a.id} className="px-4 py-3 border-b last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{a.treatment_name}</div>
                <div className="text-sm">{centsToEuro(a.final_price_cents)}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(a.starts_at).toLocaleString('it-IT')} · {a.status}
              </div>
              {a.notes ? (
                <div className="text-xs text-muted-foreground mt-1">{a.notes}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
