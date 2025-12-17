'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

/* =======================
   Types
======================= */

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  schema_name: string;
  is_active: boolean;
  created_at?: string;
};

type ListTenantsResponse = {
  tenants: TenantRow[];
};

/* =======================
   Small UI helpers
======================= */

function StatusPill({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        active
          ? 'border-border bg-accent text-foreground'
          : 'border-border bg-muted text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'mr-1 inline-block h-2 w-2 rounded-full',
          active ? 'bg-foreground' : 'bg-muted-foreground',
        )}
      />
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('doflow_token');
}

/* =======================
   Page
======================= */

export default function SuperadminDashboardPage() {
  const router = useRouter();

  const [tenants, setTenants] = React.useState<TenantRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const token = getToken();
    if (!token) router.push('/login');
  }, [router]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<ListTenantsResponse>('/api/superadmin/tenants', {
        headers: { 'x-doflow-tenant-id': 'public' },
        cache: 'no-store',
      });

      setTenants(Array.isArray(data?.tenants) ? data.tenants : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const kpi = React.useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.is_active).length;
    const disabled = total - active;
    return { total, active, disabled };
  }, [tenants]);

  const recentTenants = React.useMemo(() => {
    return [...tenants]
      .sort((a, b) => {
        const da = a.created_at ? Date.parse(a.created_at) : 0;
        const db = b.created_at ? Date.parse(b.created_at) : 0;
        return db - da;
      })
      .slice(0, 6);
  }, [tenants]);

  function openTenant(slug: string) {
    window.location.assign(`https://${slug}.doflow.it/admin/users`);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">
            Control Plane — panoramica globale dei tenant
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? 'Aggiorno…' : 'Aggiorna'}
          </Button>
          <Link href="/superadmin/tenants">
            <Button size="sm">Gestisci tenants</Button>
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="p-3">
          <div className="text-sm font-medium">Errore</div>
          <div className="mt-1 text-sm text-muted-foreground">{error}</div>
        </Card>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard label="Tenants totali" value={loading ? '—' : kpi.total} />
        <MetricCard label="Tenants attivi" value={loading ? '—' : kpi.active} />
        <MetricCard label="Tenants disabilitati" value={loading ? '—' : kpi.disabled} />
      </div>

      {/* System status (placeholder) */}
      <Card className="p-4">
        <div className="text-sm font-semibold">System status</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusPill active={false} label="API" />
          <StatusPill active={false} label="DB" />
          <StatusPill active={false} label="Redis" />
          <StatusPill active={false} label="Realtime" />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Placeholder — collegheremo health reali negli step successivi.
        </div>
      </Card>

      {/* Recent tenants */}
      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">Ultimi tenant</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-medium">Slug</th>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Stato</th>
                <th className="px-4 py-3 text-right font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                    Caricamento…
                  </td>
                </tr>
              ) : recentTenants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                    Nessun tenant.
                  </td>
                </tr>
              ) : (
                recentTenants.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 font-medium">{t.slug}</td>
                    <td className="px-4 py-3">{t.name}</td>
                    <td className="px-4 py-3">
                      <StatusPill active={t.is_active} label={t.is_active ? 'active' : 'disabled'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openTenant(t.slug)}>
                        Entra
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
