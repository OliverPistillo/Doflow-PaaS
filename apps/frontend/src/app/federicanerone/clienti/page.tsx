'use client';

import * as React from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, User, Phone, Mail, Trophy, TrendingUp } from 'lucide-react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


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
  is_vip: boolean; // --- MODIFICA VIP: Arriva dal backend ---
};

type StatsData = {
  topClients: { name: string; value: number }[];
};

// --- HELPER ---
function money(cents: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function daysAgo(dateStr: string | null) {
  if (!dateStr) return 'Mai';
  const diff = new Date().getTime() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 3600 * 24));
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Ieri';
  return `${days} gg fa`;
}

// Colori per il grafico Top 10
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
    }, 300); // Debounce ricerca
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

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clienti</h1>
            <p className="text-sm text-muted-foreground">Analisi, gestione e storico clienti.</p>
          </div>
          <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Nuovo Cliente
          </Button>
        </div>

        {/* --- SEZIONE STATISTICHE (STRATEGIA) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Card 1: Top 5 Clienti (Grafico) */}
          <Card className="lg:col-span-2 border-l-4 border-l-emerald-500 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-emerald-500" /> Top Clienti per Fatturato
              </CardTitle>
              <CardDescription>I clienti che hanno generato più valore nel tempo.</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px]">
              {stats && stats.topClients.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topClients} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                    <Tooltip
                      formatter={(value) => {
                        const n =
                          typeof value === "number"
                            ? value
                            : value == null
                              ? 0
                              : Number(value)

                        return [`€${n.toFixed(2)}`, "Speso"] as [string, string]
                      }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                        {stats.topClients.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Nessun dato sufficiente per le statistiche.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* --- LISTA CLIENTI --- */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Elenco Completo</CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cerca nome, telefono..." 
                className="pl-8" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clients.map(c => {
                // --- MODIFICA VIP: Logica Badge dal Backend ---
                // Non calcoliamo più localmente. Usiamo il flag del DB.
                const isVip = c.is_vip; 
                
                const daysSinceLast = c.last_visit_at ? Math.floor((new Date().getTime() - new Date(c.last_visit_at).getTime()) / (1000 * 3600 * 24)) : 999;
                const isDormant = daysSinceLast > 60 && c.total_appointments > 0;

                return (
                  <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                        {c.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {c.full_name}
                          {isVip && (
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="secondary"
                                  className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200 text-[10px] px-1.5 py-0 h-5 cursor-help"
                                >
                                  VIP
                                </Badge>
                              </TooltipTrigger>

                              <TooltipContent side="top" align="start" className="w-[280px] p-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold">VIP = cliente ad alto valore</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      Attuale: {money(c.total_spent_cents)}
                                    </div>
                                  </div>

                                  <div className="text-[11px] text-muted-foreground leading-snug">
                                    Il cliente ha superato la soglia di spesa nel periodo configurato.
                                  </div>
                                </div>
                              </TooltipContent>
                            </UITooltip>
                          )}
                          {isDormant && <Badge variant="outline" className="text-gray-500 border-gray-300 text-[10px] px-1.5 py-0 h-5">Inattivo da {daysSinceLast}gg</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                          {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>}
                          {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right min-w-[80px]">
                        <div className="text-muted-foreground text-xs">Spesa Totale</div>
                        <div className="font-bold text-emerald-600">{money(c.total_spent_cents)}</div>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <div className="text-muted-foreground text-xs">Ultima Visita</div>
                        <div className="font-medium">{daysAgo(c.last_visit_at)}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(c)}>Modifica</Button>
                        <Button variant="ghost" size="sm" className="text-red-500 h-8 w-8 p-0" onClick={() => handleDelete(c.id)}>
                          <span className="sr-only">Elimina</span>
                          ×
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {clients.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">Nessun cliente trovato.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* DIALOG CREA/MODIFICA */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? 'Modifica Cliente' : 'Nuovo Cliente'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
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