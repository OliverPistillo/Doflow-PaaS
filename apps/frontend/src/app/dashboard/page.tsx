'use client';

import * as React from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type Cliente = { id: number };
type Trattamento = { id: number; name: string };
type Appuntamento = {
  id: number;
  client_id: number;
  treatment_id: number;
  treatment_name?: string;
  starts_at: string;
  final_price_cents: number | null;
  status: string;
};

function euro(cents: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(key: string) {
  // "2026-01" -> "Gen"
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleDateString('it-IT', { month: 'short' });
}

export default function FedericaOverviewPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [clienti, setClienti] = React.useState<Cliente[]>([]);
  const [trattamenti, setTrattamenti] = React.useState<Trattamento[]>([]);
  const [appuntamenti, setAppuntamenti] = React.useState<Appuntamento[]>([]);

  // filtro anno semplice (come nello screenshot)
  const now = new Date();
  const [year, setYear] = React.useState<number>(now.getFullYear());

  React.useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [c, t, a] = await Promise.all([
          apiFetch<{ clienti: Cliente[] }>('/api/clienti'),
          apiFetch<{ trattamenti: Trattamento[] }>('/api/trattamenti'),
          apiFetch<{ appuntamenti: Appuntamento[] }>('/api/appuntamenti'),
        ]);

        if (!alive) return;
        setClienti(Array.isArray(c?.clienti) ? c.clienti : []);
        setTrattamenti(Array.isArray(t?.trattamenti) ? t.trattamenti : []);
        setAppuntamenti(Array.isArray(a?.appuntamenti) ? a.appuntamenti : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Errore caricamento dati');
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const computed = React.useMemo(() => {
    const yearApps = appuntamenti.filter((x) => {
      const d = new Date(x.starts_at);
      return d.getFullYear() === year;
    });

    const revenueCents = yearApps.reduce((sum, x) => sum + (x.final_price_cents ?? 0), 0);

    // KPI per status (adatta qui ai tuoi status reali)
    const statusCount = new Map<string, number>();
    for (const a of yearApps) statusCount.set(a.status ?? 'unknown', (statusCount.get(a.status ?? 'unknown') ?? 0) + 1);

    // fatturato per mese
    const monthMap = new Map<string, number>();
    for (const a of yearApps) {
      const d = new Date(a.starts_at);
      const k = monthKey(d);
      monthMap.set(k, (monthMap.get(k) ?? 0) + (a.final_price_cents ?? 0));
    }

    // ordina mesi
    const months = Array.from(monthMap.keys()).sort();
    const monthlyRevenue = months.map((k) => ({
      month: monthLabel(k),
      value: Math.round((monthMap.get(k) ?? 0) / 100), // euro interi per scala grafico
    }));

    // distribuzione trattamenti (conteggio)
    const treatCount = new Map<string, number>();
    for (const a of yearApps) {
      const name = a.treatment_name || `Trattamento #${a.treatment_id}`;
      treatCount.set(name, (treatCount.get(name) ?? 0) + 1);
    }

    const treatArr = Array.from(treatCount.entries())
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value);

    const topTreatments = treatArr.slice(0, 8);

    return {
      yearAppsCount: yearApps.length,
      revenueCents,
      clientsCount: clienti.length,
      treatmentsCount: trattamenti.length,
      statusCount,
      monthlyRevenue,
      topTreatments,
    };
  }, [appuntamenti, clienti.length, trattamenti.length, year]);

  const years = React.useMemo(() => {
    const set = new Set<number>();
    for (const a of appuntamenti) set.add(new Date(a.starts_at).getFullYear());
    const arr = Array.from(set).sort((a, b) => b - a);
    return arr.length ? arr : [new Date().getFullYear()];
  }, [appuntamenti]);

  if (loading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Caricamento overview…</div>;
  }
  if (error) {
    return (
      <Card className="p-4">
        <div className="text-sm font-medium">Errore</div>
        <div className="text-sm text-muted-foreground mt-1">{error}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            KPI e statistiche per l’anno selezionato.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <Link href="/federicanerone/clienti">
            <Button variant="outline" size="sm">Clienti</Button>
          </Link>
          <Link href="/federicanerone/trattamenti">
            <Button variant="outline" size="sm">Trattamenti</Button>
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Fatturato totale</div>
          <div className="text-2xl font-semibold mt-1">{euro(computed.revenueCents)}</div>
          <div className="text-xs text-muted-foreground mt-2">{computed.yearAppsCount} appuntamenti</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Clienti</div>
          <div className="text-2xl font-semibold mt-1">{computed.clientsCount}</div>
          <div className="text-xs text-muted-foreground mt-2">Anagrafica totale</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Trattamenti</div>
          <div className="text-2xl font-semibold mt-1">{computed.treatmentsCount}</div>
          <div className="text-xs text-muted-foreground mt-2">Nel listino</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Stati (conteggio)</div>
          <div className="mt-2 space-y-1 text-sm">
            {Array.from(computed.statusCount.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card className="p-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Fatturato mensile</div>
              <div className="text-xs text-muted-foreground">Euro (approssimato)</div>
            </div>
          </div>

          <div className="h-[280px] mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={computed.monthlyRevenue}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold">Distribuzione trattamenti</div>
          <div className="text-xs text-muted-foreground">Top 8 per volume</div>

          <div className="h-[280px] mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={computed.topTreatments}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {computed.topTreatments.map((_, i) => (
                    <Cell key={i} /> // colori automatici
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top treatments table */}
      <Card className="p-4">
        <div className="text-sm font-semibold">Top trattamenti</div>
        <div className="text-xs text-muted-foreground">Per numero di appuntamenti ({year})</div>

        <div className="mt-3 divide-y">
          {computed.topTreatments.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6">Nessun dato per l’anno selezionato.</div>
          ) : (
            computed.topTreatments.map((t) => (
              <div key={t.name} className="py-2 flex items-center justify-between gap-3">
                <div className="text-sm truncate">{t.name}</div>
                <div className="text-sm font-medium">{t.value}</div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
